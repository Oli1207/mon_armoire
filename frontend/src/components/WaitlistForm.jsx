import { useState } from 'react';
import { waitlistAPI } from '../utils/api';
import { errorText, fieldErrors } from '../utils/errors';
import { subscribeToPush } from '../utils/push';
import useAuthStore from '../store/auth';
import { Link } from 'react-router-dom';
import { detectDevice, needsInstallForPush } from '../utils/device';

const pushAvailable = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  && 'Notification' in window && Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY);

/** Inscription « prévenez-moi quand il revient » : e-mail ET téléphone (beaucoup de clientes ouvrent rarement leurs e-mails). */
export default function WaitlistForm({ variantId }) {
  const { user } = useAuthStore();
  const [form, setForm] = useState({ name: user?.full_name || '', email: user?.email || '', phone: user?.phone || '' });
  const [push, setPush] = useState(false);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    const problems = {};
    if (!form.email.trim()) problems.email = 'Indiquez votre adresse e-mail.';
    if (!form.phone.trim()) problems.phone = 'Indiquez votre numéro de téléphone (nous pouvons aussi vous écrire sur WhatsApp).';
    if (Object.keys(problems).length) { setErrors(problems); return; }

    setErrors({});
    setSending(true);
    let endpoint = '';
    let pushNote = '';
    if (push) {
      try {
        endpoint = (await subscribeToPush()).endpoint;
      } catch {
        pushNote = ' La notification n’a pas pu être activée (autorisation refusée) : vous serez prévenu(e) par e-mail et téléphone.';
      }
    }
    try {
      await waitlistAPI.join({ variant: variantId, ...form, email: form.email.trim(), phone: form.phone.trim(), push_endpoint: endpoint });
      setDone(`C’est noté ! Nous vous préviendrons dès que ce bijou sera de nouveau disponible.${pushNote}`);
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(Object.keys(fields).some((k) => k !== 'error') ? fields : { form: errorText(err, 'L’inscription n’a pas abouti. Réessayez dans un instant.') });
    } finally {
      setSending(false);
    }
  };

  if (done) return <p className="text-success small mb-0">{done}</p>;

  return (
    <form onSubmit={submit} noValidate>
      <p className="text-muted small mb-2">
        Laissez votre e-mail <strong>et</strong> votre numéro : nous vous prévenons dès son retour (e-mail{push || pushAvailable() ? ', notification' : ''}, et au besoin un message WhatsApp ou un appel).
      </p>
      <div className="mb-2">
        <label className="form-label small mb-1" htmlFor="wl-name">Votre prénom (facultatif)</label>
        <input id="wl-name" className="form-control" autoComplete="given-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="mb-2">
        <label className="form-label small mb-1" htmlFor="wl-email">Votre e-mail *</label>
        <input id="wl-email" type="email" inputMode="email" autoComplete="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {errors.email && <div className="text-danger small" role="alert">{errors.email}</div>}
      </div>
      <div className="mb-2">
        <label className="form-label small mb-1" htmlFor="wl-phone">Votre téléphone (WhatsApp si possible) *</label>
        <input id="wl-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="07 99 16 73 93" className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        {errors.phone && <div className="text-danger small" role="alert">{errors.phone}</div>}
      </div>
      {!pushAvailable() && needsInstallForPush(detectDevice()) && (
        <p className="small text-muted mb-2">Sur iPhone, pour recevoir aussi une notification, <Link to="/installer">installez d’abord l’application sur l’écran d’accueil</Link>.</p>
      )}
      {pushAvailable() && (
        <div className="form-check mb-3">
          <input id="wl-push" type="checkbox" className="form-check-input" checked={push} onChange={(e) => setPush(e.target.checked)} />
          <label className="form-check-label small" htmlFor="wl-push">Me prévenir aussi par notification sur cet appareil</label>
        </div>
      )}
      {errors.form && <div className="alert alert-danger small" role="alert">{errors.form}</div>}
      <button type="submit" className="btn btn-primary text-uppercase small tracking-wide" disabled={sending}>{sending ? 'Envoi…' : 'Me prévenir'}</button>
    </form>
  );
}
