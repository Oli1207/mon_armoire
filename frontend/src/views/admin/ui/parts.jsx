import { useEffect, useRef, useState } from 'react';
import { prepareImage } from '../../../utils/prepareImage';

export const MAX_IMAGE_MB = 25;
// Les extensions : sous Windows, « image/* » seul masque souvent les photos iPhone
export const IMAGE_ACCEPT = 'image/*,.heic,.heif,.avif,.tif,.tiff,.jfif';

export const ORDER_STATUS_LABELS = {
  pending: 'En attente de paiement', paid: 'Payée', processing: 'En préparation',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

export const fcfa = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

export const shortDate = (value) => new Date(value).toLocaleDateString('fr-FR');

export { errorText, fieldErrors } from '../../../utils/errors';

/** Amène à l'écran un formulaire qui vient de s'ouvrir (sur téléphone, il s'ouvre souvent hors de la vue). */
export function useRevealOnOpen(open) {
  const ref = useRef(null);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'start' });
  }, [open]);
  return ref;
}

/** `floating` : sur téléphone, l'action principale de la page reste toujours visible en bas de l'écran. */
export function PageHeader({ kicker = 'Administration', title, lead, floating = false, children }) {
  return (
    <header className="admin-header">
      <div>
        <p className="admin-kicker">{kicker}</p>
        <h1 className="admin-title">{title}</h1>
        {lead && <p className="admin-lead">{lead}</p>}
      </div>
      {children && <div className={`admin-actions${floating ? ' is-floating' : ''}`}>{children}</div>}
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

  const handle = async (event) => {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (!picked) return;
    const chosen = await prepareImage(picked);
    if (chosen.size > MAX_IMAGE_MB * 1024 * 1024) {
      onProblem?.(`Cette photo est trop lourde (maximum ${MAX_IMAGE_MB} Mo).`);
      return;
    }
    onChange(chosen);
  };

  const shown = preview || value;
  return (
    <Field label={label} help={help || 'Toutes les photos sont acceptées : le site les adapte automatiquement.'} error={error}>
      <div className="d-flex align-items-center gap-3 flex-wrap">
        {shown ? <img src={shown} alt="" className="admin-image-preview" /> : <span className="admin-image-preview" aria-hidden="true" />}
        <label className="admin-file-drop mb-0 flex-grow-1" style={{ position: 'relative', minWidth: '12rem' }}>
          {shown ? 'Changer la photo' : 'Choisir une photo'}
          <input type="file" accept={IMAGE_ACCEPT} onChange={handle} />
        </label>
      </div>
    </Field>
  );
}
