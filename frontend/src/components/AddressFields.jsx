import { useId } from 'react';
import { COMMUNES, QUARTIERS, isAbidjan } from '../utils/abidjan';

/** Adresse de livraison : ville, commune (Abidjan), quartier, rue/repères. `value` = { city, commune, quartier, street }. */
export default function AddressFields({ value, onChange, errors = {}, small = false }) {
  const id = useId();
  const size = small ? 'form-control-sm' : '';
  const abidjan = isAbidjan(value.city);
  const suggestions = QUARTIERS[value.commune] || Object.values(QUARTIERS).flat();

  return (
    <>
      <div className="mb-2">
        <label className="form-label small mb-1" htmlFor={`${id}-city`}>Ville *</label>
        <input id={`${id}-city`} autoComplete="address-level2" className={`form-control ${size}`} value={value.city} onChange={(e) => onChange({ city: e.target.value })} />
      </div>
      {abidjan && (
        <div className="mb-2">
          <label className="form-label small mb-1" htmlFor={`${id}-commune`}>Commune *</label>
          <select id={`${id}-commune`} className={`form-select ${size}`} value={value.commune} onChange={(e) => onChange({ commune: e.target.value })}>
            <option value="">Choisissez votre commune…</option>
            {COMMUNES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.commune && <div className="text-danger small" role="alert">{errors.commune}</div>}
        </div>
      )}
      <div className="mb-2">
        <label className="form-label small mb-1" htmlFor={`${id}-quartier`}>Quartier *</label>
        <input
          id={`${id}-quartier`} list={`${id}-quartiers`} autoComplete="off" className={`form-control ${size}`}
          placeholder={abidjan ? 'Ex : Riviera, Angré, Zone 4…' : 'Votre quartier'}
          value={value.quartier} onChange={(e) => onChange({ quartier: e.target.value })}
        />
        {abidjan && <datalist id={`${id}-quartiers`}>{suggestions.map((q) => <option key={q} value={q} />)}</datalist>}
        {errors.quartier && <div className="text-danger small" role="alert">{errors.quartier}</div>}
      </div>
      <div className="mb-2">
        <label className="form-label small mb-1" htmlFor={`${id}-street`}>Rue et repères *</label>
        <input
          id={`${id}-street`} autoComplete="street-address" className={`form-control ${size}`}
          placeholder="Ex : rue des Jardins, près de la pharmacie"
          value={value.street} onChange={(e) => onChange({ street: e.target.value })}
        />
        {errors.street && <div className="text-danger small" role="alert">{errors.street}</div>}
      </div>
    </>
  );
}

/** Le lieu est-il complet ? (même règle que le serveur : commune obligatoire à Abidjan, quartier toujours) */
export const placeComplete = (value) => Boolean(value.city?.trim() && value.quartier?.trim() && value.street?.trim() && (!isAbidjan(value.city) || value.commune));
