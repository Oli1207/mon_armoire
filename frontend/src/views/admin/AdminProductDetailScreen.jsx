import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import ListStatus from '../../components/ListStatus';
import { useAdminUi } from './ui/AdminUi';
import EngravingEditor from './ui/EngravingEditor';
import { Field, IMAGE_ACCEPT, MAX_IMAGE_MB, PageHeader, errorText } from './ui/parts';
import { prepareImage } from '../../utils/prepareImage';

const EMPTY_VARIANT = { option: '', color: '', size: '', material: '', price: '', stock: '', engraving_sides: 0 };

const ENGRAVING_OPTIONS = [[0, 'Sans gravure'], [1, 'Gravure sur une face (recto)'], [2, 'Gravure sur les deux faces (recto et verso)']];
const NAME_HELP = 'Ce que la cliente voit sur le site. Ex : Simple, Gravure recto, Gravure recto-verso.';

/** Prix, stock et détails d'une variante : les mêmes cases pour la fiche et pour les autres variantes. */
function VersionFields({ variant, onSave, showName, stockLabel = 'En stock', hideStock = false }) {
  // Les champs enregistrent automatiquement quand on quitte la case, seulement si la valeur a changé
  const blurSave = (field, original) => (e) => {
    const value = e.target.value;
    if (String(value) !== String(original ?? '')) onSave(variant.id, field, value);
  };
  return (
    <>
      {showName && (
        <Field label="Nom de cette variante" help={NAME_HELP}>
          <input className="form-control" defaultValue={variant.option} onBlur={blurSave('option', variant.option)} />
        </Field>
      )}
      <div className={`admin-grid ${hideStock ? 'cols-2' : 'cols-3'}`}>
        <Field label="Prix (FCFA)"><input type="number" min="0" step="100" inputMode="numeric" className="form-control" defaultValue={variant.price} onBlur={blurSave('price', variant.price)} /></Field>
        {!hideStock && (
          <Field label={stockLabel}>
            {/* `key` : la case repart du nombre enregistré quand il change ailleurs (passage au stock commun) */}
            <input key={variant.stock} type="number" min="0" inputMode="numeric" className="form-control" defaultValue={variant.stock} onBlur={blurSave('stock', variant.stock)} />
          </Field>
        )}
        <Field label="Ancien prix barré (facultatif)" help="Affiche une réduction.">
          <input type="number" min="0" step="100" inputMode="numeric" className="form-control" defaultValue={variant.old_price ?? ''} onBlur={blurSave('old_price', variant.old_price)} />
        </Field>
      </div>
      <Field label="Gravure comprise dans ce prix" help="Avec gravure, la cliente doit écrire son texte avant d’ajouter au panier.">
        <select className="form-select" value={variant.engraving_sides} onChange={(e) => onSave(variant.id, 'engraving_sides', Number(e.target.value))}>
          {ENGRAVING_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <div className="admin-grid cols-3">
        <Field label="Couleur (facultatif)"><input className="form-control" defaultValue={variant.color} onBlur={blurSave('color', variant.color)} /></Field>
        <Field label="Taille (facultatif)"><input className="form-control" defaultValue={variant.size} onBlur={blurSave('size', variant.size)} /></Field>
        <Field label="Matériau (facultatif)"><input className="form-control" defaultValue={variant.material} onBlur={blurSave('material', variant.material)} /></Field>
      </div>
      <div className="admin-checks">
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
    </>
  );
}

function VersionPhoto({ variant, onPhoto, personalizable, onEngrave }) {
  return (
    <div className="d-flex align-items-center gap-3 flex-wrap">
      {variant.image && <img className="admin-thumb" src={variant.image} alt="" />}
      <label className="file-drop mb-0" style={{ position: 'relative' }}>
        {variant.image ? 'Changer la photo de cette variante' : 'Ajouter une photo propre à cette variante (facultatif)'}
        <input type="file" accept={IMAGE_ACCEPT} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPhoto(variant.id, f); }} />
      </label>
      {personalizable && variant.image && (
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => onEngrave(variant)}>
          {variant.engraving_zone ? 'Modifier la zone de gravure de cette photo ✓' : 'Définir la zone de gravure de cette photo'}
        </button>
      )}
    </div>
  );
}

function VariantCard({ variant, onSave, onRemove, onPhoto, personalizable, onEngrave, sharedStock }) {
  return (
    <div className="variant-card">
      <div className="variant-head">
        <strong>{variant.label}</strong>
        <button type="button" className="admin-link is-danger" onClick={() => onRemove(variant)}>Supprimer cette variante</button>
      </div>
      <VersionFields variant={variant} onSave={onSave} showName hideStock={sharedStock} />
      <VersionPhoto variant={variant} onPhoto={onPhoto} personalizable={personalizable} onEngrave={onEngrave} />
      <button type="button" className="btn btn-outline-secondary btn-sm mt-3" onClick={() => onSave(variant.id, 'is_default', true)}>
        Afficher cette variante en premier
      </button>
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
  const [variantErrors, setVariantErrors] = useState({});
  const [showAddVersion, setShowAddVersion] = useState(false);
  const [mainName, setMainName] = useState('');
  const [uploading, setUploading] = useState('');
  const [engraving, setEngraving] = useState(null); // { kind: 'image' | 'variant', target, image, zone, label }
  const [savingZone, setSavingZone] = useState(false);
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

  const saveVariant = (variantId, field, value) => run(() => adminAPI.updateVariant(variantId, { [field]: value === '' && field === 'old_price' ? null : value }), 'Enregistré.');

  const removeVariant = async (variant) => {
    const accepted = await confirm({ title: `Supprimer la variante « ${variant.label} » ?`, message: 'Cette action est définitive.', confirmLabel: 'Supprimer', danger: true });
    if (accepted) run(() => adminAPI.deleteVariant(variant.id), 'Variante supprimée.');
  };

  const addVariant = async (event) => {
    event.preventDefault();
    const main = product.variants.find((v) => v.is_default) || product.variants[0];
    const mainUnnamed = main?.label === 'Standard';
    const errors = {};
    if (newVariant.price === '') errors.price = 'Indiquez le prix.';
    if (main && !newVariant.option.trim() && !newVariant.color.trim() && !newVariant.size.trim() && !newVariant.material.trim()) {
      errors.option = 'Donnez un nom à cette variante, par exemple « Gravure recto ».';
    }
    if (mainUnnamed && !mainName.trim()) errors.mainName = 'Donnez aussi un nom à la variante actuelle, par exemple « Simple ».';
    setVariantErrors(errors);
    if (Object.keys(errors).length) return;
    const ok = await run(async () => {
      if (mainUnnamed) await adminAPI.updateVariant(main.id, { option: mainName.trim() });
      await adminAPI.createVariant(id, { ...newVariant, stock: newVariant.stock || 0 });
    }, main ? 'Variante ajoutée.' : 'Prix enregistré.');
    if (ok) {
      setNewVariant(EMPTY_VARIANT);
      setMainName('');
      setShowAddVersion(false);
    }
  };

  const uploadVariantPhoto = async (variantId, picked) => {
    const file = await prepareImage(picked);
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { notify(`Photo trop lourde (maximum ${MAX_IMAGE_MB} Mo).`, 'error'); return; }
    const data = new FormData();
    data.append('image', file);
    run(() => adminAPI.updateVariant(variantId, data), 'Photo enregistrée.');
  };

  const uploadPhotos = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    let added = 0;
    for (let i = 0; i < files.length; i += 1) {
      setUploading(`Envoi de la photo ${i + 1} sur ${files.length}…`);
      const file = await prepareImage(files[i]);
      if (file.size > MAX_IMAGE_MB * 1024 * 1024) { notify(`« ${files[i].name} » est trop lourde (maximum ${MAX_IMAGE_MB} Mo).`, 'error'); continue; }
      const data = new FormData();
      data.append('image', file);
      data.append('is_main', product.images.length + added === 0 ? 'true' : 'false');
      try {
        await adminAPI.createImage(id, data);
        added += 1;
      } catch (err) {
        notify(`« ${files[i].name} » : ${errorText(err)}`, 'error');
      }
    }
    setUploading('');
    if (added) { notify(added > 1 ? `${added} photos ajoutées.` : 'Photo ajoutée.'); load(); }
  };

  const removePhoto = async (image) => {
    const accepted = await confirm({ title: 'Supprimer cette photo ?', message: 'Elle disparaîtra de la fiche produit.', confirmLabel: 'Supprimer', danger: true });
    if (accepted) run(() => adminAPI.deleteImage(image.id), 'Photo supprimée.');
  };

  const saveZone = async (zone) => {
    setSavingZone(true);
    const action = engraving.kind === 'image'
      ? () => adminAPI.saveImageZone(engraving.target, zone)
      : () => adminAPI.updateVariant(engraving.target, { engraving_zone: zone });
    const ok = await run(action, zone ? 'Zone de gravure enregistrée. Ouvrez « Voir sur le site » pour l’essayer.' : 'Zone de gravure supprimée pour cette photo.');
    setSavingZone(false);
    if (ok) setEngraving(null);
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
  const mainVersion = product.variants.find((v) => v.is_default) || product.variants[0];
  const otherVersions = product.variants.filter((v) => v !== mainVersion);
  const onEngraveVersion = (variant) => setEngraving({ kind: 'variant', target: variant.id, image: variant.image, zone: variant.engraving_zone, label: `photo de la variante « ${variant.label} »` });

  const versionForm = (
    <form className="variant-card is-new" onSubmit={addVariant} noValidate>
      {mainVersion?.label === 'Standard' && (
        <Field label={`Nom de la variante actuelle (${Number(mainVersion.price).toLocaleString('fr-FR')} FCFA) *`} error={variantErrors.mainName} help="Il en faut un dès qu’il y a un choix sur le site. Ex : Simple.">
          <input className="form-control" value={mainName} onChange={(e) => setMainName(e.target.value)} />
        </Field>
      )}
      {mainVersion && (
        <Field label="Nom de la nouvelle variante *" error={variantErrors.option} help={NAME_HELP}>
          <input className="form-control" value={newVariant.option} onChange={(e) => setNewVariant({ ...newVariant, option: e.target.value })} />
        </Field>
      )}
      <div className="admin-grid cols-2">
        <Field label="Prix (FCFA) *" error={variantErrors.price}><input type="number" min="0" step="100" inputMode="numeric" className="form-control" value={newVariant.price} onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value })} /></Field>
        {(!mainVersion || !product.shared_stock) && (
          <Field label="En stock"><input type="number" min="0" inputMode="numeric" className="form-control" value={newVariant.stock} onChange={(e) => setNewVariant({ ...newVariant, stock: e.target.value })} /></Field>
        )}
      </div>
      <Field label="Gravure comprise dans ce prix">
        <select className="form-select" value={newVariant.engraving_sides} onChange={(e) => setNewVariant({ ...newVariant, engraving_sides: Number(e.target.value) })}>
          {ENGRAVING_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Field>
      <div className="admin-grid cols-3">
        <Field label="Couleur (facultatif)"><input className="form-control" value={newVariant.color} onChange={(e) => setNewVariant({ ...newVariant, color: e.target.value })} /></Field>
        <Field label="Taille (facultatif)"><input className="form-control" value={newVariant.size} onChange={(e) => setNewVariant({ ...newVariant, size: e.target.value })} /></Field>
        <Field label="Matériau (facultatif)"><input className="form-control" value={newVariant.material} onChange={(e) => setNewVariant({ ...newVariant, material: e.target.value })} /></Field>
      </div>
      <div className="d-flex gap-2 flex-wrap">
        <button type="submit" className="btn btn-primary">{mainVersion ? 'Ajouter cette variante' : 'Enregistrer le prix'}</button>
        {mainVersion && <button type="button" className="btn btn-outline-secondary" onClick={() => setShowAddVersion(false)}>Annuler</button>}
      </div>
    </form>
  );

  return (
    <div>
      <Link to="/admin/produits" className="admin-link mb-2">← Retour aux produits</Link>
      <PageHeader kicker="Produit" title={product.name}>
        <Link to={`/produits/${product.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary">Voir sur le site</Link>
      </PageHeader>

      <div className="admin-jump" role="group" aria-label="Aller à une partie de la fiche">
        {[['infos', 'Infos'], ['prix', 'Prix et stock'], ['photos', 'Photos'], ['variantes', 'Variantes']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ block: 'start' })}>{label}</button>
        ))}
      </div>

      <section id="infos" className="admin-card" key={`info-${epoch}`}>
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
        </div>
        {product.is_personalizable && (
          <>
            <Field
              label="Nombre maximum de lettres de la gravure" htmlFor="p-maxchars"
              help="Exemple : 12 pour un prénom sur une médaille, 20 pour une plaque. La cliente ne peut pas dépasser ce nombre."
            >
              <input id="p-maxchars" type="number" min="1" max="60" inputMode="numeric" className="form-control" style={{ maxWidth: '8rem' }} defaultValue={product.engraving_max_chars} onBlur={(e) => { if (e.target.value !== String(product.engraving_max_chars)) saveField('engraving_max_chars', e.target.value); }} />
            </Field>
            <p className="admin-help">
              Pour que la cliente voie un aperçu réaliste, définissez <strong>où le texte apparaît</strong> sur chaque photo : section « Photos » plus bas, bouton « Zone de gravure » sous la photo.
              {!product.images.some((i) => i.engraving_zone) && ' Aucune zone n’est encore définie : sans zone, la cliente n’a pas d’aperçu (la gravure reste commandable).'}
            </p>
          </>
        )}
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

      <section id="prix" className="admin-card" key={`price-${mainVersion?.id}-${epoch}`}>
        <h2 className="admin-card-title">Prix et stock</h2>
        {mainVersion ? (
          <>
            <VersionFields
              variant={mainVersion} onSave={saveVariant} showName={otherVersions.length > 0}
              stockLabel={otherVersions.length > 0 && product.shared_stock ? 'En stock (commun à toutes les variantes)' : 'En stock'}
            />
            {mainVersion.image && <VersionPhoto variant={mainVersion} onPhoto={uploadVariantPhoto} personalizable={product.is_personalizable} onEngrave={onEngraveVersion} />}
          </>
        ) : (
          <>
            <p className="admin-help mb-3">Indiquez le prix : sans prix, ce produit ne peut pas être acheté.</p>
            {versionForm}
          </>
        )}
      </section>

      <section id="photos" className="admin-card">
        <h2 className="admin-card-title">Photos</h2>
        {product.images.length === 0 && <p className="admin-help mb-3">Aucune photo pour le moment : ajoutez-en au moins une, la première devient la photo principale.</p>}
        <div className="admin-image-grid">
          {product.images.map((img) => (
            <div className="admin-image-tile" key={img.id}>
              {img.is_main && <span className="admin-main-flag">Principale</span>}
              <img src={img.thumbnail || img.image} alt="" loading="lazy" />
              <div className="tile-actions">
                {product.is_personalizable && (
                  <button type="button" onClick={() => setEngraving({ kind: 'image', target: img.id, image: img.image, zone: img.engraving_zone, label: img.is_main ? 'photo principale' : 'cette photo' })}>
                    {img.engraving_zone ? 'Zone de gravure ✓' : 'Zone de gravure'}
                  </button>
                )}
                {!img.is_main && <button type="button" onClick={() => run(() => adminAPI.setMainImage(img.id), 'Photo principale modifiée.')}>Mettre en principale</button>}
                <button type="button" className="is-danger" onClick={() => removePhoto(img)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
        <label className="file-drop mb-0" style={{ position: 'relative' }}>
          {uploading || '+ Ajouter des photos (plusieurs à la fois possible)'}
          <input type="file" accept={IMAGE_ACCEPT} multiple onChange={uploadPhotos} disabled={Boolean(uploading)} />
        </label>
        <p className="admin-card-note">Toutes les photos sont acceptées : le site les réduit automatiquement pour rester rapide.</p>
      </section>

      {engraving && (
        <EngravingEditor
          key={`${engraving.kind}-${engraving.target}`}
          image={engraving.image} zone={engraving.zone} label={engraving.label} saving={savingZone}
          onSave={saveZone} onRemove={() => saveZone(null)} onClose={() => setEngraving(null)}
        />
      )}

      {mainVersion && (
        <section id="variantes" className="admin-card">
          <h2 className="admin-card-title">Autres variantes de ce produit</h2>
          <p className="admin-help mb-3">
            Seulement si ce même produit existe aussi avec un autre prix, une autre couleur ou une gravure. Exemple : simple 4 500, gravure recto 10 000, gravure recto-verso 12 000. La cliente choisira sur le site.
          </p>
          {otherVersions.map((v) => (
            <VariantCard
              key={`${v.id}-${epoch}`} variant={v} onSave={saveVariant} onRemove={removeVariant} onPhoto={uploadVariantPhoto}
              personalizable={product.is_personalizable} onEngrave={onEngraveVersion} sharedStock={product.shared_stock}
            />
          ))}
          {(otherVersions.length > 0 || showAddVersion) && (
            <div className="form-check mb-3">
              <input
                id="p-shared-stock" type="checkbox" className="form-check-input" checked={product.shared_stock}
                onChange={(e) => saveField('shared_stock', e.target.checked, e.target.checked ? 'Stock commun à toutes les variantes.' : 'Chaque variante a maintenant son propre stock.')}
              />
              <label className="form-check-label" htmlFor="p-shared-stock">Stock commun à toutes les variantes</label>
              <p className="admin-help mb-0">C’est le même objet : une vente enlève une pièce pour toutes les variantes. Décochez seulement si elles sont vraiment différentes, par exemple deux couleurs.</p>
            </div>
          )}
          {showAddVersion ? versionForm : (
            <button type="button" className="btn btn-outline-primary" onClick={() => setShowAddVersion(true)}>+ Ajouter une autre variante</button>
          )}
        </section>
      )}
    </div>
  );
}
