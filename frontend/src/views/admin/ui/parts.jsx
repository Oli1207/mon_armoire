import { useEffect, useState } from 'react';

export const MAX_IMAGE_MB = 15;

export const ORDER_STATUS_LABELS = {
  pending: 'En attente de paiement', paid: 'Payée', processing: 'En préparation',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

export const fcfa = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

export const shortDate = (value) => new Date(value).toLocaleDateString('fr-FR');

/** Message lisible pour une erreur d'API (message du serveur si disponible, sinon texte simple). */
export function errorText(err, fallback = 'Une erreur est survenue. Veuillez réessayer.') {
  if (!err?.response) return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
  const data = err.response.data;
  if (!data || typeof data === 'string') return fallback;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  const first = Object.values(data)[0];
  const message = Array.isArray(first) ? first[0] : first;
  return typeof message === 'string' ? message : fallback;
}

/** Erreurs par champ d'un formulaire : { nom: 'message' } (réponse 400 de l'API). */
export function fieldErrors(err) {
  const data = err?.response?.data;
  if (!data || typeof data !== 'object') return {};
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? String(value[0]) : String(value)]),
  );
}

export function PageHeader({ kicker = 'Administration', title, lead, children }) {
  return (
    <header className="admin-header">
      <div>
        <p className="admin-kicker">{kicker}</p>
        <h1 className="admin-title">{title}</h1>
        {lead && <p className="admin-lead">{lead}</p>}
      </div>
      {children && <div className="admin-actions">{children}</div>}
    </header>
  );
}

export function StatusBadge({ status, label }) {
  return <span className={`status-badge status-${status}`}>{label ?? ORDER_STATUS_LABELS[status] ?? status}</span>;
}

export function Field({ label, help, error, htmlFor, children }) {
  return (
    <div className="admin-field">
      {label && <label className="admin-label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <p className="admin-error" role="alert">{error}</p> : help && <p className="admin-help">{help}</p>}
    </div>
  );
}

/** Photo : aperçu de l'existante ou de la nouvelle, avec contrôle du poids avant envoi. */
export function ImageField({ label = 'Photo', value, file, onChange, onProblem, help, error }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handle = (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    if (chosen.size > MAX_IMAGE_MB * 1024 * 1024) {
      onProblem?.(`Cette photo est trop lourde (maximum ${MAX_IMAGE_MB} Mo).`);
      return;
    }
    onChange(chosen);
  };

  const shown = preview || value;
  return (
    <Field label={label} help={help || 'Formats JPEG, PNG ou WebP.'} error={error}>
      <div className="d-flex align-items-center gap-3 flex-wrap">
        {shown ? <img src={shown} alt="" className="admin-image-preview" /> : <span className="admin-image-preview" aria-hidden="true" />}
        <label className="admin-file-drop mb-0 flex-grow-1" style={{ position: 'relative', minWidth: '12rem' }}>
          {shown ? 'Changer la photo' : 'Choisir une photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handle} />
        </label>
      </div>
    </Field>
  );
}
