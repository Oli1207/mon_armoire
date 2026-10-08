import { useRef, useState } from 'react';
import EngravingPreview, { COLOR_HEX, COLOR_LABELS, FONT_LABELS, STYLE_LABELS, curveFrom } from '../../../components/EngravingPreview';
import { Field } from './parts';

const MODES = {
  plate: { title: 'À plat', help: 'Le texte est posé à plat dans un rectangle, droit ou incliné. Pour une médaille, une plaque, une barrette de bracelet.' },
  arc: { title: 'En courbe', help: 'Le texte suit une courbe que vous tracez avec 3 points. Pour une chaîne, un collier, un pendentif rond.' },
  beads: { title: 'Lettres sur perles', help: 'Chaque lettre est dans une perle ronde, alignées le long d’une ligne ou d’une courbe. Pour un chapelet ou un bracelet de perles à lettres.' },
};

const DEFAULTS = {
  plate: { mode: 'plate', font: 'script', style: 'silver', uppercase: false, x: 0.5, y: 0.8, w: 0.35, h: 0.1, angle: 0 },
  arc: { mode: 'arc', font: 'elegant', style: 'silver', uppercase: false, points: [[0.2, 0.72], [0.5, 0.84], [0.8, 0.72]] },
  beads: { mode: 'beads', font: 'modern', uppercase: true, points: [[0.15, 0.7], [0.5, 0.82], [0.85, 0.7]], bead_size: 0.08, bead_color: 'white', letter_color: 'pink' },
};

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const round = (v) => Math.round(v * 10000) / 10000;

export default function EngravingEditor({ image, zone, label, onSave, onRemove, onClose, saving }) {
  const frame = useRef(null);
  const [draft, setDraft] = useState(zone || null);
  const [sample, setSample] = useState('Awa');

  const patch = (changes) => setDraft((d) => ({ ...d, ...changes }));
  const chooseMode = (mode) => setDraft((d) => ({ ...DEFAULTS[mode], font: d?.font && mode !== 'beads' && d.mode !== 'beads' ? d.font : DEFAULTS[mode].font }));

  const toFrame = (event) => {
    const box = frame.current.getBoundingClientRect();
    return [clamp((event.clientX - box.left) / box.width), clamp((event.clientY - box.top) / box.height)];
  };

  // Un « poignée » se déplace au doigt ou à la souris ; `apply` reçoit la position dans la photo (de 0 à 1)
  const dragHandle = (apply) => ({
    onPointerDown: (event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); },
    onPointerMove: (event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) apply(toFrame(event)); },
  });

  const movePoint = (index) => ([x, y]) => setDraft((d) => ({ ...d, points: d.points.map((p, i) => (i === index ? [round(x), round(y)] : p)) }));
  const moveCenter = ([x, y]) => patch({ x: round(x), y: round(y) });
  const resizePlate = ([px, py]) => setDraft((d) => {
    const radians = (-d.angle * Math.PI) / 180;
    const dx = px - d.x;
    const dy = py - d.y;
    const rx = dx * Math.cos(radians) - dy * Math.sin(radians);
    const ry = dx * Math.sin(radians) + dy * Math.cos(radians);
    return { ...d, w: round(clamp(Math.abs(rx) * 2, 0.05)), h: round(clamp(Math.abs(ry) * 2, 0.03)) };
  });

  const handles = [];
  if (draft?.mode === 'plate') {
    const radians = (draft.angle * Math.PI) / 180;
    const corner = [draft.x + ((draft.w / 2) * Math.cos(radians) - (draft.h / 2) * Math.sin(radians)), draft.y + ((draft.w / 2) * Math.sin(radians) + (draft.h / 2) * Math.cos(radians))];
    handles.push({ key: 'move', at: [draft.x, draft.y], label: 'Déplacer la zone', drag: dragHandle(moveCenter), kind: 'move' });
    handles.push({ key: 'size', at: corner, label: 'Agrandir ou réduire la zone', drag: dragHandle(resizePlate), kind: 'size' });
  } else if (draft) {
    draft.points.forEach((p, i) => handles.push({
      key: `p${i}`, at: p, label: ['Début de la ligne', 'Milieu de la ligne (courbure)', 'Fin de la ligne'][i], drag: dragHandle(movePoint(i)), kind: 'point', number: i + 1,
    }));
  }

  const guide = draft && draft.mode !== 'plate' ? curveFrom(draft.points) : null;

  return (
    <section className="admin-card engrave-editor" aria-label="Définir la zone de gravure">
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <h2 className="admin-card-title mb-2">Zone de gravure — {label}</h2>
        <button type="button" className="admin-link" onClick={onClose}>Fermer sans enregistrer</button>
      </div>

      <ol className="admin-help engrave-steps">
        <li><strong>Choisissez le type de zone</strong> ci-dessous (à plat, en courbe, ou lettres sur perles).</li>
        <li><strong>Placez la zone sur la photo</strong> en faisant glisser les ronds avec le doigt ou la souris.</li>
        <li><strong>Tapez un prénom d’essai</strong> : le résultat apparaît tout de suite, tel que la cliente le verra.</li>
        <li>Réglez la police et les couleurs, puis cliquez sur <strong>« Enregistrer la zone »</strong>.</li>
      </ol>

      <div className="engrave-modes" role="radiogroup" aria-label="Type de zone">
        {Object.entries(MODES).map(([key, m]) => (
          <button
            key={key} type="button" role="radio" aria-checked={draft?.mode === key}
            className={`engrave-mode ${draft?.mode === key ? 'is-active' : ''}`} onClick={() => chooseMode(key)}
          >
            <strong>{m.title}</strong>
            <span>{m.help}</span>
          </button>
        ))}
      </div>

      {!draft && <p className="admin-help">Choisissez d’abord un type de zone pour voir la photo avec ses repères.</p>}

      <div className="engrave-layout">
        <div>
          <div className="engrave-frame" ref={frame}>
            {image ? <img src={image} alt="Photo du bijou sur laquelle placer la zone" draggable="false" /> : <div className="engrave-noimage">Pas de photo</div>}
            {draft && <EngravingPreview zone={draft} text={sample || 'Awa'} />}
            {draft && (
              <svg className="engrave-guides" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
                {draft.mode === 'plate' && (
                  <rect
                    x={(draft.x - draft.w / 2) * 1000} y={(draft.y - draft.h / 2) * 1000} width={draft.w * 1000} height={draft.h * 1000}
                    transform={`rotate(${draft.angle} ${draft.x * 1000} ${draft.y * 1000})`} fill="none" stroke="#c9a227" strokeWidth="4" strokeDasharray="14 10"
                  />
                )}
                {guide && <path d={guide.path} fill="none" stroke="#c9a227" strokeWidth="4" strokeDasharray="14 10" />}
              </svg>
            )}
            {handles.map((h) => (
              <button
                key={h.key} type="button" aria-label={h.label} title={h.label}
                className={`engrave-handle is-${h.kind}`} style={{ left: `${h.at[0] * 100}%`, top: `${h.at[1] * 100}%` }} {...h.drag}
              >
                {h.number || (h.kind === 'size' ? '↔' : '✥')}
              </button>
            ))}
          </div>
          <p className="admin-help mt-2">
            {draft?.mode === 'plate' && 'Rond « ✥ » : déplace la zone. Rond « ↔ » : l’agrandit ou la réduit. Le curseur « Inclinaison » la fait pivoter.'}
            {draft && draft.mode !== 'plate' && 'Les ronds 1, 2 et 3 : début, milieu et fin de la ligne. Déplacez le 2 pour courber plus ou moins.'}
          </p>
        </div>

        {draft && (
          <div className="engrave-controls">
            <Field label="Prénom d’essai" htmlFor="eg-sample" help="Écrivez un nom court, puis un long, pour vérifier que les deux tiennent bien.">
              <input id="eg-sample" className="form-control" maxLength={30} autoComplete="off" value={sample} onChange={(e) => setSample(e.target.value)} />
            </Field>

            {draft.mode !== 'beads' && (
              <>
                <Field label="Matière du texte" htmlFor="eg-style" help="Choisissez la couleur qui se lit le mieux sur la photo.">
                  <select id="eg-style" className="form-select" value={draft.style} onChange={(e) => patch({ style: e.target.value })}>
                    {Object.entries(STYLE_LABELS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                  </select>
                </Field>
                <Field label="Police" htmlFor="eg-font">
                  <select id="eg-font" className="form-select" value={draft.font} onChange={(e) => patch({ font: e.target.value })}>
                    {Object.entries(FONT_LABELS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                  </select>
                </Field>
                <div className="form-check mb-3">
                  <input id="eg-upper" type="checkbox" className="form-check-input" checked={draft.uppercase} onChange={(e) => patch({ uppercase: e.target.checked })} />
                  <label className="form-check-label" htmlFor="eg-upper">Tout en MAJUSCULES</label>
                </div>
              </>
            )}

            {draft.mode === 'plate' && (
              <>
                <Field label={`Inclinaison : ${Math.round(draft.angle)}°`} htmlFor="eg-angle" help="Glissez pour pencher le texte comme le bijou sur la photo.">
                  <input id="eg-angle" type="range" min="-90" max="90" step="1" className="form-range" value={draft.angle} onChange={(e) => patch({ angle: Number(e.target.value) })} />
                </Field>
                <Field label={`Largeur : ${Math.round(draft.w * 100)} %`} htmlFor="eg-w">
                  <input id="eg-w" type="range" min="5" max="100" step="1" className="form-range" value={Math.round(draft.w * 100)} onChange={(e) => patch({ w: Number(e.target.value) / 100 })} />
                </Field>
                <Field label={`Hauteur : ${Math.round(draft.h * 100)} %`} htmlFor="eg-h">
                  <input id="eg-h" type="range" min="3" max="60" step="1" className="form-range" value={Math.round(draft.h * 100)} onChange={(e) => patch({ h: Number(e.target.value) / 100 })} />
                </Field>
              </>
            )}

            {draft.mode === 'beads' && (
              <>
                <Field label={`Taille des perles : ${Math.round(draft.bead_size * 100)} %`} htmlFor="eg-bead" help="Si le prénom est long, les perles rétrécissent toutes seules pour tenir sur la ligne.">
                  <input id="eg-bead" type="range" min="3" max="20" step="1" className="form-range" value={Math.round(draft.bead_size * 100)} onChange={(e) => patch({ bead_size: Number(e.target.value) / 100 })} />
                </Field>
                {[['bead_color', 'Couleur des perles'], ['letter_color', 'Couleur des lettres']].map(([key, name]) => (
                  <Field label={name} htmlFor={`eg-${key}`} key={key}>
                    <div className="d-flex align-items-center gap-2">
                      <span className="engrave-swatch" style={{ background: COLOR_HEX[draft[key]] }} aria-hidden="true" />
                      <select id={`eg-${key}`} className="form-select" value={draft[key]} onChange={(e) => patch({ [key]: e.target.value })}>
                        {Object.entries(COLOR_LABELS).map(([color, text]) => <option key={color} value={color}>{text}</option>)}
                      </select>
                    </div>
                  </Field>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="d-flex gap-2 flex-wrap mt-3">
        <button type="button" className="btn btn-primary" disabled={!draft || saving} onClick={() => onSave(draft)}>{saving ? 'Enregistrement…' : 'Enregistrer la zone'}</button>
        {zone && <button type="button" className="btn btn-outline-danger" disabled={saving} onClick={onRemove}>Supprimer la zone de cette photo</button>}
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Fermer</button>
      </div>
    </section>
  );
}
