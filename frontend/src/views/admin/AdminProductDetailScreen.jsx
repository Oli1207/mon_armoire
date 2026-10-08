import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import ListStatus from '../../components/ListStatus';
import { useAdminUi } from './ui/AdminUi';
import { Field, MAX_IMAGE_MB, PageHeader, errorText } from './ui/parts';

const EMPTY_VARIANT = { color: '', size: '', material: '', price: '', stock: '' };

function VariantCard({ variant, onSave, onRemove, onPhoto }) {
  // Les champs enregistrent automatiquement quand on quitte la case, seulement si la valeur a changé
  const blurSave = (field, original) => (e) => {
    const value = e.target.value;
    if (String(value) !== String(original ?? '')) onSave(variant.id, field, value);
  };
  return (
    <div className="variant-card">
      <div className="variant-head">
        <strong>{variant.label}</strong>
        <button type="button" className="admin-link is-danger" onClick={() => onRemove(variant)}>Supprimer cette variante</button>
      </div>
      <div className="admin-grid cols-3">
        <Field label="Couleur"><input className="form-control" defaultValue={variant.color} onBlur={blurSave('color', variant.color)} /></Field>
        <Field label="Taille"><input className="form-control" defaultValue={variant.size} onBlur={blurSave('size', variant.size)} /></Field>
        <Field label="Matériau"><input className="form-control" defaultValue={variant.material} onBlur={blurSave('material', variant.material)} /></Field>
      </div>
      <div className="admin-grid cols-3">
        <Field label="Prix (FCFA)"><input type="number" min="0" step="100" inputMode="numeric" className="form-control" defaultValue={variant.price} onBlur={blurSave('price', variant.price)} /></Field>
        <Field label="En stock"><input type="number" min="0" inputMode="numeric" className="form-control" defaultValue={variant.stock} onBlur={blurSave('stock', variant.stock)} /></Field>
        <Field label="Ancien prix barré (facultatif)" help="Affiche une réduction.">
          <input type="number" min="0" step="100" inputMode="numeric" className="form-control" defaultValue={variant.old_price ?? ''} onBlur={blurSave('old_price', variant.old_price)} />
        </Field>
      </div>
      <div className="admin-checks">
        <div className="form-check">
          <input id={`def-${variant.id}`} type="checkbox" className="form-check-input" checked={variant.is_default} onChange={(e) => onSave(variant.id, 'is_default', e.target.checked)} />
          <label className="form-check-label" htmlFor={`def-${variant.id}`}>Variante présentée en premier</label>
        </div>
        <div className="form-check">
          <input id={`pre-${variant.id}`} type="checkbox" className="form-check-input" checked={variant.allow_preorder} onChange={(e) => onSave(variant.id, 'allow_preorder', e.target.checked)} />
          <label className="form-check-label" htmlFor={`pre-${variant.id}`}>Précommande possible quand le stock est à zéro</label>
        </div>
      </div>
      {variant.allow_preorder && (
        <Field label="Message de précommande" help="Ex : Retour en stock mi-décembre">
          <input className="form-control" defaultValue={variant.restock_note} onBlur={blurSave('restock_note', variant.restock_note)} />
        </Field>
      )}
      <div className="d-flex align-items-center gap-3 flex-wrap">
        {variant.image && <img className="admin-thumb" src={variant.image} alt="" />}
        <label className="file-drop mb-0" style={{ position: 'relative' }}>
          {variant.image ? 'Changer la photo de cette variante' : 'Ajouter une photo propre à cette variante (facultatif)'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPhoto(variant.id, f); }} />
        </label>
      </div>
    </div>
  );
}

export default function AdminProductDetailScreen() {
  const { id } = useParams();
  const { notify, confirm } = useAdminUi();
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [newVariant, setNewVariant] = useState(EMPTY_VARIANT);
  const [variantError, setVariantError] = useState('');
  const [uploading, setUploading] = useState('');
  // Incrémenté seulement après une erreur : les champs repartent des valeurs enregistrées (sinon on ne touche pas aux champs : le focus reste)
  const [epoch, setEpoch] = useState(0);

  const load = useCallback(() => {
    adminAPI.productDetail(id).then(({ data }) => { setProduct(data); setLoadError(''); }).catch((err) => setLoadError(errorText(err, 'Produit introuvable.')));
  }, [id]);

  useEffect(() => {
    load();
    adminAPI.categories().then(({ data }) => setCategories(data)).catch(() => {});
    adminAPI.collections().then(({ data }) => setOccasions(data)).catch(() => {});
  }, [load]);

  const run = async (action, success) => {
    try {
      await action();
      if (success) notify(success);
      load();
      return true;
    } catch (err) {
      notify(errorText(err), 'error');
      setEpoch((e) => e + 1);
      load();
      return false;
    }
  };

  const saveField = (field, value, success = 'Enregistré.') => run(() => adminAPI.updateProduct(id, { [field]: value }), success);

  const saveVariant = (variantId, field, value) => run(() => adminAPI.updateVariant(variantId, { [field]: value === '' && field === 'old_price' ? null : value }), 'Variante enregistrée.');

  const removeVariant = async (variant) => {
    const accepted = await confirm({ title: `Supprimer la variante « ${variant.label} » ?`, message: 'Cette action est définitive.', confirmLabel: 'Supprimer', danger: true });
    if (accepted) run(() => adminAPI.deleteVariant(variant.id), 'Variante supprimée.');
  };

  const addVariant = async (event) => {
    event.preventDefault();
    if (newVariant.price === '') { setVariantError('Indiquez le prix de cette variante.'); return; }
    setVariantError('');
    const ok = await run(() => adminAPI.createVariant(id, { ...newVariant, stock: newVariant.stock || 0 }), 'Variante ajoutée.');
    if (ok) setNewVariant(EMPTY_VARIANT);
  };

  const uploadVariantPhoto = async (variantId, file) => {
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { notify(`Photo trop lourde (maximum ${MAX_IMAGE_MB} Mo).`, 'error'); return; }
    const data = new FormData();
    data.append('image', file);
    run(() => adminAPI.updateVariant(variantId, data), 'Photo de la variante enregistrée.');
  };

  const uploadPhotos = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) { notify(`« ${file.name} » est trop lourde (maximum ${MAX_IMAGE_MB} Mo).`, 'error'); continue; }
      setUploading(`Envoi de la photo ${i + 1} sur ${files.length}…`);
      const data = new FormData();
      data.append('image', file);
      data.append('is_main', product.images.length === 0 && i === 0 ? 'true' : 'false');
      try { await adminAPI.createImage(id, data); } catch (err) { notify(errorText(err), 'error'); }
    }
    setUploading('');
    if (files.length) { notify(files.length > 1 ? 'Photos ajoutées.' : 'Photo ajoutée.'); load(); }
  };

  const removePhoto = async (image) => {
    const accepted = await confirm({ title: 'Supprimer cette photo ?', message: 'Elle disparaîtra de la fiche produit.', confirmLabel: 'Supprimer', danger: true });
    if (accepted) run(() => adminAPI.deleteImage(image.id), 'Photo supprimée.');
  };

  if (!product) {
    return (
      <div>
        <PageHeader kicker="Produit" title="…" />
        <ListStatus loading={!loadError} error={loadError} onRetry={load} isEmpty rows={3} />
      </div>
    );
  }

  const blur = (field) => (e) => { if (e.target.value !== (product[field] ?? '')) saveField(field, e.target.value); };
  const occasionIds = product.collections.map(String);

  return (
    <div>
      <Link to="/admin/produits" className="admin-link mb-2">← Retour aux produits</Link>
      <PageHeader kicker="Produit" title={product.name}>
        <Link to={`/produits/${product.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary">Voir sur le site</Link>
      </PageHeader>

      <section className="admin-card" key={`info-${epoch}`}>
        <h2 className="admin-card-title">Informations</h2>
        <div className="admin-grid cols-2">
          <Field label="Nom" htmlFor="p-name"><input id="p-name" className="form-control" defaultValue={product.name} onBlur={blur('name')} /></Field>
          <Field label="Catégorie" htmlFor="p-cat">
            <select id="p-cat" className="form-select" value={product.category || ''} onChange={(e) => saveField('category', e.target.value || null)}>
              <option value="">— Aucune —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description" htmlFor="p-desc"><textarea id="p-desc" rows={4} className="form-control" defaultValue={product.description} onBlur={blur('description')} /></Field>
        <Field label="Signification symbolique" htmlFor="p-sym" help="Affichée sur la fiche dans un encadré « Signification » (facultatif).">
          <textarea id="p-sym" rows={3} className="form-control" defaultValue={product.symbolic_meaning} onBlur={blur('symbolic_meaning')} />
        </Field>
        <div className="admin-checks">
          <div className="form-check form-switch">
            <input id="p-active" type="checkbox" role="switch" className="form-check-input" checked={product.is_active} onChange={(e) => saveField('is_active', e.target.checked, e.target.checked ? 'Produit visible sur le site.' : 'Produit caché du site.')} />
            <label className="form-check-label" htmlFor="p-active">Visible sur le site</label>
          </div>
          <div className="form-check">
            <input id="p-new" type="checkbox" className="form-check-input" checked={product.is_new} onChange={(e) => saveField('is_new', e.target.checked)} />
            <label className="form-check-label" htmlFor="p-new">Nouveauté</label>
          </div>
          <div className="form-check">
            <input id="p-perso" type="checkbox" className="form-check-input" checked={product.is_personalizable} onChange={(e) => saveField('is_personalizable', e.target.checked)} />
            <label className="form-check-label" htmlFor="p-perso">Personnalisable (texte de gravure)</label>
          </div>
        </div>
        {occasions.length > 0 && (
          <Field label="Occasions" help="Pour apparaître dans « Je cherche un cadeau ».">
            <div className="admin-checks">
              {occasions.map((o) => {
                const checked = occasionIds.includes(String(o.id));
                return (
                  <div className="form-check" key={o.id}>
                    <input
                      id={`occ-${o.id}`} type="checkbox" className="form-check-input" checked={checked}
                      onChange={() => saveField('collections', checked ? occasionIds.filter((x) => x !== String(o.id)) : [...occasionIds, String(o.id)])}
                    />
                    <label className="form-check-label" htmlFor={`occ-${o.id}`}>{o.name}</label>
                  </div>
                );
              })}
            </div>
          </Field>
        )}
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Photos</h2>
        {product.images.length === 0 && <p className="admin-help mb-3">Aucune photo pour le moment : ajoutez-en au moins une, la première devient la photo principale.</p>}
        <div className="admin-image-grid">
          {product.images.map((img) => (
            <div className="admin-image-tile" key={img.id}>
              {img.is_main && <span className="admin-main-flag">Principale</span>}
              <img src={img.thumbnail || img.image} alt="" loading="lazy" />
              <div className="tile-actions">
                {!img.is_main && <button type="button" onClick={() => run(() => adminAPI.setMainImage(img.id), 'Photo principale modifiée.')}>Mettre en principale</button>}
                <button type="button" className="is-danger" onClick={() => removePhoto(img)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
        <label className="file-drop mb-0" style={{ position: 'relative' }}>
          {uploading || '+ Ajouter des photos (JPEG, PNG ou WebP — plusieurs à la fois possible)'}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadPhotos} disabled={Boolean(uploading)} />
        </label>
        <p className="admin-card-note">Photos réduites automatiquement pour que le site reste rapide. Maximum {MAX_IMAGE_MB} Mo par photo.</p>
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Variantes (couleurs, tailles, prix, stock)</h2>
        {product.variants.length === 0 && <p className="admin-help mb-3">Ajoutez au moins une variante : sans variante, le produit ne peut pas être acheté.</p>}
        {product.variants.map((v) => (
          <VariantCard key={`${v.id}-${epoch}`} variant={v} onSave={saveVariant} onRemove={removeVariant} onPhoto={uploadVariantPhoto} />
        ))}

        <form className="variant-card is-new" onSubmit={addVariant} noValidate>
          <div className="variant-head"><strong>Ajouter une variante</strong></div>
          <div className="admin-grid cols-3">
            <Field label="Couleur"><input className="form-control" value={newVariant.color} onChange={(e) => setNewVariant({ ...newVariant, color: e.target.value })} /></Field>
            <Field label="Taille"><input className="form-control" value={newVariant.size} onChange={(e) => setNewVariant({ ...newVariant, size: e.target.value })} /></Field>
            <Field label="Matériau"><input className="form-control" value={newVariant.material} onChange={(e) => setNewVariant({ ...newVariant, material: e.target.value })} /></Field>
          </div>
          <div className="admin-grid cols-3">
            <Field label="Prix (FCFA) *" error={variantError}><input type="number" min="0" step="100" inputMode="numeric" className="form-control" value={newVariant.price} onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })} /></Field>
            <Field label="En stock"><input type="number" min="0" inputMode="numeric" className="form-control" value={newVariant.stock} onChange={(e) => setNewVariant({ ...newVariant, stock: e.target.value })} /></Field>
          </div>
          <button type="submit" className="btn btn-primary">Ajouter la variante</button>
        </form>
      </section>
    </div>
  );
}
