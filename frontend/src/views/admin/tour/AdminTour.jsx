import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../../store/auth';
import { authAPI } from '../../../utils/api';
import { buildSteps } from './steps';

export const START_TOUR_EVENT = 'admin-tour-start';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Didactiel de l'Admin, adapté au rôle. Se lance tout seul à la première visite de chaque personne de l'équipe,
 * puis plus jamais, sauf si elle clique sur « Revoir le didactiel » (page Guide pas à pas).
 * Un panneau non bloquant explique l'écran affiché et entoure en doré l'élément dont on parle.
 */
export default function AdminTour() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [index, setIndex] = useState(-1);
  const autoStarted = useRef(false);
  const nextButton = useRef(null);

  const rightsKey = `${user?.staff?.role}|${(user?.staff?.permissions || []).join(',')}`;
  const steps = useMemo(() => buildSteps(user), [rightsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Démarrage automatique : une seule fois, tant que la personne n'a ni terminé ni passé le didactiel
  useEffect(() => {
    if (!user?.staff || user.staff.tour_seen !== false || autoStarted.current) return undefined;
    const timer = setTimeout(() => { autoStarted.current = true; setIndex(0); }, 1200);   // (marqué au déclenchement, pas avant : le mode strict de React rejoue l'effet)
    return () => clearTimeout(timer);
  }, [user?.staff]);

  // Démarrage à la demande (bouton « Revoir le didactiel »)
  useEffect(() => {
    const start = () => setIndex(0);
    window.addEventListener(START_TOUR_EVENT, start);
    return () => window.removeEventListener(START_TOUR_EVENT, start);
  }, []);

  const finish = useCallback(async () => {
    setIndex(-1);
    if (user?.staff?.tour_seen === false) {
      try {
        const { data } = await authAPI.markTourSeen();
        useAuthStore.setState({ user: data });
      } catch { /* sans gravité : le didactiel pourrait se relancer à la prochaine visite */ }
    }
  }, [user?.staff?.tour_seen]);

  const step = index >= 0 ? steps[index] : null;

  // À chaque étape : ouvrir l'écran concerné, puis entourer l'élément visé
  useEffect(() => {
    if (!step) return undefined;
    if (step.route && pathname !== step.route) navigate(step.route);
    let cancelled = false;
    (async () => {
      if (!step.target) return;
      for (let i = 0; i < 30 && !cancelled; i += 1) {
        const element = document.querySelector(step.target);
        if (element) {
          element.classList.add('tour-highlight');
          element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
          return;
        }
        await wait(150);
      }
    })();
    nextButton.current?.focus();
    return () => {
      cancelled = true;
      document.querySelectorAll('.tour-highlight').forEach((el) => el.classList.remove('tour-highlight'));
    };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!step) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, finish]);

  if (!step) return null;
  const last = index === steps.length - 1;

  return (
    <div className="admin-tour" role="dialog" aria-live="polite" aria-label="Didactiel de l’Admin">
      <p className="admin-tour-count">Étape {index + 1} sur {steps.length}</p>
      <h2 className="admin-tour-title">{step.title}</h2>
      <p className="admin-tour-body">{step.body}</p>
      <div className="admin-tour-actions">
        {index > 0 && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setIndex(index - 1)}>Précédent</button>}
        <button ref={nextButton} type="button" className="btn btn-primary btn-sm" onClick={() => (last ? finish() : setIndex(index + 1))}>{last ? 'Terminer' : 'Suivant'}</button>
        {!last && <button type="button" className="admin-link" onClick={finish}>Passer le didactiel</button>}
      </div>
    </div>
  );
}
