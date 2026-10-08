import { useCallback, useEffect, useState } from 'react';
import useAuthStore from '../../../store/auth';
import { can } from '../../../utils/permissions';
import { errorText } from '../../../utils/errors';
import { getPushState, subscribeToPush, unsubscribeFromPush } from '../../../utils/push';
import { detectDevice, needsInstallForPush } from '../../../utils/device';
import { Link } from 'react-router-dom';
import { useAdminUi } from './AdminUi';

/** Activer / désactiver les alertes de l'équipe (nouvelle commande, stock faible, nouvel avis…) sur l'appareil utilisé. */
export default function StaffAlerts() {
  const { user } = useAuthStore();
  const { notify } = useAdminUi();
  const [state, setState] = useState('checking');   // checking | unsupported | denied | off | on
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => { getPushState().then(setState).catch(() => setState('unsupported')); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (!can(user, 'orders', 'catalog', 'reviews', 'waitlist') || state === 'checking') return null;
  if (state === 'on') {
    return (
      <div className="admin-alerts is-on" role="status">
        <span>✓ Les alertes (nouvelle commande, stock faible…) sont actives sur cet appareil.</span>
        <button
          type="button" className="admin-link" disabled={busy}
          onClick={async () => {
            setBusy(true);
            try { await unsubscribeFromPush(); notify('Alertes désactivées sur cet appareil.'); } catch (err) { notify(errorText(err), 'error'); }
            setBusy(false); refresh();
          }}
        >Désactiver</button>
      </div>
    );
  }

  if (state === 'unsupported' && needsInstallForPush(detectDevice())) {
    return (
      <div className="admin-alerts" role="note">
        <span>Sur iPhone, les alertes ne marchent qu’avec l’application installée sur l’écran d’accueil (iOS 16.4 ou plus récent). Installez-la, puis ouvrez l’Admin depuis la nouvelle icône.</span>
        <Link to="/installer" className="btn btn-primary btn-sm">Voir comment installer</Link>
      </div>
    );
  }
  const messages = {
    unsupported: 'Ce navigateur ne peut pas afficher d’alertes. Utilisez une version à jour de Chrome, Edge ou Safari.',
    denied: 'Les notifications sont bloquées pour ce site. Touchez le cadenas à côté de l’adresse en haut du navigateur, autorisez les notifications, puis rechargez la page.',
  };
  if (state !== 'off') return <div className="admin-alerts" role="note">{messages[state]}</div>;

  return (
    <div className="admin-alerts">
      <span>
        <strong>Soyez prévenue en direct.</strong> Activez les alertes sur cet appareil : une notification s’affiche à chaque nouvelle commande payée, stock faible, nouvel avis ou nouvelle inscription en liste d’attente
        (selon vos droits).
      </span>
      <button
        type="button" className="btn btn-primary btn-sm" disabled={busy}
        onClick={async () => {
          setBusy(true);
          try { await subscribeToPush(); notify('Alertes activées sur cet appareil.'); } catch (err) { notify(err?.response ? errorText(err) : (err.message || 'Impossible d’activer les alertes.'), 'error'); }
          setBusy(false); refresh();
        }}
      >{busy ? 'Activation…' : 'Activer les alertes sur cet appareil'}</button>
    </div>
  );
}
