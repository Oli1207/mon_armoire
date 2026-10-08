import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Palettes (les clés sont les mêmes que côté serveur : catalog/engraving.py)
export const COLOR_HEX = {
  white: '#fbfbfb', pink: '#e45a92', gold: '#c9a227', black: '#222222', blue: '#3b6fd4', green: '#2e8b57', red: '#c0392b', silver: '#bfc3c7',
};
export const COLOR_LABELS = {
  white: 'Blanc', pink: 'Rose', gold: 'Doré', black: 'Noir', blue: 'Bleu', green: 'Vert', red: 'Rouge', silver: 'Argenté',
};
export const FONT_FAMILY = {
  script: "'Neucha', 'Cabin Sketch', cursive",
  elegant: "Georgia, 'Times New Roman', serif",
  classic: "'Times New Roman', Times, serif",
  modern: "'Helvetica Neue', Arial, sans-serif",
};
export const FONT_LABELS = { script: 'Manuscrite', elegant: 'Élégante (italique)', classic: 'Classique', modern: 'Moderne' };
export const STYLE_LABELS = { silver: 'Gravé sur argent', gold: 'Gravé sur or', dark: 'Gravé foncé', white: 'Blanc (sur fond sombre)' };
const STYLE_PAINT = {
  silver: { main: '#575d63', light: '#ffffff', weight: 700 },
  gold: { main: '#7a5a12', light: '#f6e39a', weight: 700 },
  dark: { main: '#1b1b1b', light: 'rgba(255,255,255,0.4)', weight: 700 },
  white: { main: '#ffffff', light: 'rgba(0,0,0,0.5)', weight: 700 },
};
const SIZE = 1000; // l'aperçu est dessiné dans un carré de 1000 × 1000, mis à l'échelle par le navigateur

/** Courbe qui passe exactement par les 3 points (début, milieu, fin) : courbe de Bézier dont on déduit le point de contrôle. */
export function curveFrom(points) {
  const [a, m, b] = points.map(([x, y]) => [x * SIZE, y * SIZE]);
  const c = [2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2];
  return { a, c, b, path: `M ${a[0]} ${a[1]} Q ${c[0]} ${c[1]} ${b[0]} ${b[1]}` };
}

function bezierPoint({ a, c, b }, t) {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

/** Échantillonne la courbe : tableau de points avec la longueur cumulée (pour répartir des perles à distance égale). */
function sampleCurve(curve, steps = 160) {
  const samples = [{ p: bezierPoint(curve, 0), len: 0 }];
  for (let i = 1; i <= steps; i += 1) {
    const p = bezierPoint(curve, i / steps);
    const prev = samples[i - 1];
    samples.push({ p, len: prev.len + Math.hypot(p[0] - prev.p[0], p[1] - prev.p[1]) });
  }
  return samples;
}

function pointAt(samples, distance) {
  const total = samples[samples.length - 1].len;
  const d = Math.max(0, Math.min(total, distance));
  let i = 1;
  while (i < samples.length - 1 && samples[i].len < d) i += 1;
  const [s0, s1] = [samples[i - 1], samples[i]];
  const k = s1.len === s0.len ? 0 : (d - s0.len) / (s1.len - s0.len);
  return [s0.p[0] + (s1.p[0] - s0.p[0]) * k, s0.p[1] + (s1.p[1] - s0.p[1]) * k];
}

function Plate({ zone, text }) {
  const paint = STYLE_PAINT[zone.style] || STYLE_PAINT.silver;
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  const boxW = zone.w * SIZE;
  const boxH = zone.h * SIZE;
  const fontSize = Math.max(10, boxH * 0.72);
  useLayoutEffect(() => {
    const natural = ref.current?.getComputedTextLength?.() || 0;
    setScale(natural > 0 ? Math.min(1, (boxW * 0.94) / natural) : 1);
  }, [text, zone.font, zone.uppercase, boxW, fontSize]);
  const common = { fontFamily: FONT_FAMILY[zone.font], fontSize, fontWeight: paint.weight, textAnchor: 'middle', dominantBaseline: 'central' };
  return (
    <g transform={`translate(${zone.x * SIZE} ${zone.y * SIZE}) rotate(${zone.angle})`}>
      <g transform={`scale(${scale})`}>
        <text {...common} fill={paint.light} transform="translate(1.6 2)">{text}</text>
        <text ref={ref} {...common} fill={paint.main}>{text}</text>
      </g>
    </g>
  );
}

function Arc({ zone, text, id }) {
  const paint = STYLE_PAINT[zone.style] || STYLE_PAINT.silver;
  const curve = useMemo(() => curveFrom(zone.points), [zone.points]);
  const length = useMemo(() => sampleCurve(curve).at(-1).len, [curve]);
  const fontSize = Math.max(16, Math.min(90, length / (Math.max(text.length, 4) * 0.62)));
  const common = { fontFamily: FONT_FAMILY[zone.font], fontSize, fontWeight: paint.weight };
  return (
    <g>
      <path id={id} d={curve.path} fill="none" stroke="none" />
      <text {...common} fill={paint.light} dy="2"><textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{text}</textPath></text>
      <text {...common} fill={paint.main}><textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{text}</textPath></text>
    </g>
  );
}

function Beads({ zone, text }) {
  const samples = useMemo(() => sampleCurve(curveFrom(zone.points)), [zone.points]);
  const total = samples.at(-1).len;
  const chars = [...text];
  const units = chars.reduce((sum, ch) => sum + (ch === ' ' ? 0.5 : 1), 0); // un espace = un demi-écart
  const wanted = zone.bead_size * SIZE;
  const diameter = Math.max(14, Math.min(wanted, total / Math.max(units, 1) / 1.04));
  const pitch = diameter * 1.04;
  let cursor = Math.max(0, (total - pitch * Math.max(units - 1, 0)) / 2);
  const placed = chars.map((ch) => {
    if (ch === ' ') { cursor += pitch * 0.5; return null; }
    const position = pointAt(samples, cursor);
    cursor += pitch;
    return { ch, position };
  }).filter(Boolean);
  const bead = COLOR_HEX[zone.bead_color] || COLOR_HEX.white;
  const letter = COLOR_HEX[zone.letter_color] || COLOR_HEX.pink;
  return (
    <g>
      {placed.map(({ ch, position }, i) => (
        <g key={i} transform={`translate(${position[0]} ${position[1]})`}>
          <circle r={diameter / 2} fill={bead} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
          <circle cx={-diameter * 0.15} cy={-diameter * 0.18} r={diameter * 0.12} fill="#fff" opacity="0.55" />
          <text fill={letter} fontFamily={FONT_FAMILY.modern} fontWeight="800" fontSize={diameter * 0.58} textAnchor="middle" dominantBaseline="central">{ch.toUpperCase()}</text>
        </g>
      ))}
    </g>
  );
}

/** Aperçu de la gravure dessiné par-dessus la photo (le parent doit être en position relative et carré). */
export default function EngravingPreview({ zone, text }) {
  const id = useId().replace(/:/g, '');
  const clean = (text || '').trim();
  if (!zone || !clean) return null;
  const shown = zone.mode !== 'beads' && zone.uppercase ? clean.toUpperCase() : clean;
  return (
    <svg className="engraving-overlay" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
      {zone.mode === 'plate' && <Plate zone={zone} text={shown} />}
      {zone.mode === 'arc' && <Arc zone={zone} text={shown} id={`arc-${id}`} />}
      {zone.mode === 'beads' && <Beads zone={zone} text={clean} />}
    </svg>
  );
}
