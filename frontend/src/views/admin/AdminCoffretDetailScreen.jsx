import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import ListStatus from '../../components/ListStatus';
import { useAdminUi } from './ui/AdminUi';
import { Field, ImageField, PageHeader, errorText, fcfa } from './ui/parts';

const EMPTY_SLOT = { label: '', allowed_category: '', min_select: 1, max_select: 1 };

export default function AdminCoffretDetailScreen() {
  const { id } = useParams();
  const { notify, confirm } = useAdminUi();
  const [coffret, setCoffret] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [categories, setCategories] = useState([]);
  const [variantOptions, setVariantOptions] = useState([]);
  const [newSlot, setNewSlot] = useState(EMPTY_SLOT);
  const [newItem, setNewItem] = useState({ variant_id: '', quantity: 1 });
  const [epoch, setEpoch] = useState(0);

  const load = useCallback(() => {
    adminAPI.coffretDetail(id).then(({ data }) => { setCoffret(data); setLoadError(''); }).catch((err) => setLoadError(errorText(err, 'Coffret introuvable.')));
  }, [id]);

  useEffect(() => {
    load();
    adminAPI.categories().then(({ data }) => setCategories(data)).catch(() => {});
    adminAPI.variantOptions().then(({ data }) => setVariantOptions(data)).catch(() => {});
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

  const saveField = (field, value, success = 'Enregistré.') => run(() => adminAPI.updateCoffret(id, { [field]: value }), success);
  const blur = (field) => (e) => { if (String(e.target.value) !== String(coffret[field] ?? '')) saveField(field, e.target.value); };

  const uploadImage = (file) => {
    const data = new FormData();
    data.append('image', file);
    run(() => adminAPI.updateCoffret(id, data), 'Photo du coffret enregistrée.');
  };

  const removeWithConfirm = async (title, action, success) => {
    const accepted = await confirm({ title, confirmLabel: 'Supprimer', danger: true });
    if (accepted) run(action, success);
  };

  const addSlot = async () => {
    const ok = await run(() => adminAPI.createSlot(id, { ...newSlot, allowed_category: newSlot.allowed_category || null }), 'Emplacement ajouté.');
    if (ok) setNewSlot(EMPTY_SLOT);
  };

  const addItem = async () => {
    if (!newItem.variant_id) { notify('Choisissez un article à ajouter.', 'error'); return; }
    const ok = await run(() => adminAPI.createCoffretItem(id, newItem), 'Article ajouté au coffret.');
    if (ok) setNewItem({ variant_id: '', quantity: 1 });
  };

  if (!coffret) {
    return (
      <div>
        <PageHeader kicker="Coffret" title="…" />
        <ListStatus loading={!loadError} error={loadError} onRetry={load} isEmpty rows={3} />
      </div>
    );
  }

  return (
    <div>
      <Link to="/admin/coffrets" className="admin-link mb-2">← Retour aux coffrets</Link>
      <PageHeader kicker="Coffret" title={coffret.name}>
        <Link to={`/coffrets/${coffret.slug}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary">Voir sur le site</Link>
      </PageHeader>

      <section className="admin-card" key={`info-${epoch}`}>
        <h2 className="admin-card-title">Informations</h2>
        <div className="admin-grid cols-2">
          <Field label="Nom" htmlFor="k-name"><input id="k-name" className="form-control" defaultValue={coffret.name} onBlur={blur('name')} /></Field>
          <Field label="Prix du contenant (FCFA)" htmlFor="k-price" help={`Prix de départ affiché : ${fcfa(coffret.starting_price)} (contenant + articles inclus).`}>
            <input id="k-price" type="number" min="0" step="100" inputMode="numeric" className="form-control" defaultValue={coffret.box_price} onBlur={blur('box_price')} />
          </Field>
        </div>
        <Field label="Description" htmlFor="k-desc"><textarea id="k-desc" rows={3} className="form-control" defaultValue={coffret.description} onBlur={blur('description')} /></Field>
        <ImageField label="Photo du coffret" value={coffret.image} onChange={uploadImage} onProblem={(m) => notify(m, 'error')} />
        <div className="form-check form-switch">
          <input id="k-active" type="checkbox" role="switch" className="form-check-input" checked={coffret.is_active} onChange={(e) => saveField('is_active', e.target.checked, e.target.checked ? 'Coffret visible sur le site.' : 'Coffret caché du site.')} />
          <label className="form-check-label" htmlFor="k-active">Visible sur le site</label>
        </div>
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Ce que la cliente voit</h2>
        <div className="form-check mb-2">
          <input id="k-show" type="checkbox" className="form-check-input" checked={coffret.show_contents} onChange={(e) => saveField('show_contents', e.target.checked)} />
          <label className="form-check-label" htmlFor="k-show">Elle voit le détail du contenu</label>
        </div>
        <div className="form-check mb-2">
          <input id="k-prices" type="checkbox" className="form-check-input" checked={coffret.show_item_prices} disabled={!coffret.show_contents} onChange={(e) => saveField('show_item_prices', e.target.checked)} />
          <label className="form-check-label" htmlFor="k-prices">Elle voit le prix de chaque article (sinon seulement le total)</label>
        </div>
        <div className="form-check mb-2">
          <input id="k-custom" type="checkbox" className="form-check-input" checked={coffret.allow_customization} disabled={!coffret.show_contents} onChange={(e) => saveField('allow_customization', e.target.checked)} />
          <label className="form-check-label" htmlFor="k-custom">Elle peut retirer des articles ou en ajouter</label>
        </div>
        <p className="admin-card-note">
          Contenu masqué : coffret « surprise » à prix fixe. Contenu visible sans personnalisation : composition figée mais transparente (ex. coffret de Noël annoncé à 180 000 FCFA).
        </p>
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Articles inclus d'office</h2>
        <div className="admin-table-wrap mb-3">
          <table className="admin-table">
            <thead><tr><th>Article</th><th>Quantité</th><th>Prix unitaire</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {coffret.included_items.length === 0 && <tr><td colSpan={4} className="cell-muted">Aucun article inclus pour le moment.</td></tr>}
              {coffret.included_items.map((item) => (
                <tr key={`${item.id}-${epoch}`}>
                  <td><strong>{item.product_name}</strong> <span className="cell-muted">({item.variant.label})</span></td>
                  <td>
                    <input
                      type="number" min="1" inputMode="numeric" className="form-control form-control-sm" style={{ width: '5.5rem' }} aria-label={`Quantité de ${item.product_name}`}
                      defaultValue={item.quantity}
                      onBlur={(e) => { if (e.target.value !== String(item.quantity)) run(() => adminAPI.updateCoffretItem(item.id, { quantity: e.target.value }), 'Quantité enregistrée.'); }}
                    />
                  </td>
                  <td className="cell-muted">{fcfa(item.variant.price)}</td>
                  <td className="cell-actions">
                    <button type="button" className="admin-link is-danger" onClick={() => removeWithConfirm(`Retirer « ${item.product_name} » du coffret ?`, () => adminAPI.deleteCoffretItem(item.id), 'Article retiré.')}>Retirer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-grid cols-3">
          <Field label="Ajouter un article" htmlFor="k-item">
            <select id="k-item" className="form-select" value={newItem.variant_id} onChange={(e) => setNewItem({ ...newItem, variant_id: e.target.value })}>
              <option value="">Choisir un article…</option>
              {variantOptions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Quantité" htmlFor="k-qty">
            <input id="k-qty" type="number" min="1" inputMode="numeric" className="form-control" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} />
          </Field>
          <div className="admin-field d-flex align-items-end"><button type="button" className="btn btn-primary" onClick={addItem}>Ajouter</button></div>
        </div>
      </section>

      <section className="admin-card">
        <h2 className="admin-card-title">Choix laissés à la cliente</h2>
        <p className="admin-help mb-3">Chaque emplacement est un choix : « Choisissez un collier », « Choisissez une médaille »… La cliente en sélectionne le nombre indiqué.</p>
        {coffret.slots.map((s) => (
          <div className="variant-card" key={`${s.id}-${epoch}`}>
            <div className="variant-head">
              <strong>{s.label}</strong>
              <button type="button" className="admin-link is-danger" onClick={() => removeWithConfirm(`Supprimer l'emplacement « ${s.label} » ?`, () => adminAPI.deleteSlot(s.id), 'Emplacement supprimé.')}>Supprimer</button>
            </div>
            <div className="admin-grid cols-4">
              <Field label="Intitulé">
                <input className="form-control" defaultValue={s.label} onBlur={(e) => { if (e.target.value !== s.label) run(() => adminAPI.updateSlot(s.id, { label: e.target.value }), 'Enregistré.'); }} />
              </Field>
              <Field label="Catégorie proposée">
                <select className="form-select" defaultValue={s.allowed_category?.id || ''} onChange={(e) => run(() => adminAPI.updateSlot(s.id, { allowed_category: e.target.value || null }), 'Enregistré.')}>
                  <option value="">Toutes les catégories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Minimum">
                <input type="number" min="0" inputMode="numeric" className="form-control" defaultValue={s.min_select} onBlur={(e) => { if (e.target.value !== String(s.min_select)) run(() => adminAPI.updateSlot(s.id, { min_select: e.target.value }), 'Enregistré.'); }} />
              </Field>
              <Field label="Maximum">
                <input type="number" min="1" inputMode="numeric" className="form-control" defaultValue={s.max_select} onBlur={(e) => { if (e.target.value !== String(s.max_select)) run(() => adminAPI.updateSlot(s.id, { max_select: e.target.value }), 'Enregistré.'); }} />
              </Field>
            </div>
          </div>
        ))}

        <div className="variant-card is-new">
          <div className="variant-head"><strong>Ajouter un emplacement</strong></div>
          <div className="admin-grid cols-4">
            <Field label="Intitulé" htmlFor="s-label"><input id="s-label" className="form-control" placeholder="Ex : Choisissez un collier" value={newSlot.label} onChange={(e) => setNewSlot({ ...newSlot, label: e.target.value })} /></Field>
            <Field label="Catégorie proposée" htmlFor="s-cat">
              <select id="s-cat" className="form-select" value={newSlot.allowed_category} onChange={(e) => setNewSlot({ ...newSlot, allowed_category: e.target.value })}>
                <option value="">Toutes les catégories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Minimum" htmlFor="s-min"><input id="s-min" type="number" min="0" inputMode="numeric" className="form-control" value={newSlot.min_select} onChange={(e) => setNewSlot({ ...newSlot, min_select: e.target.value })} /></Field>
            <Field label="Maximum" htmlFor="s-max"><input id="s-max" type="number" min="1" inputMode="numeric" className="form-control" value={newSlot.max_select} onChange={(e) => setNewSlot({ ...newSlot, max_select: e.target.value })} /></Field>
          </div>
          <button type="button" className="btn btn-primary" disabled={!newSlot.label.trim()} onClick={addSlot}>Ajouter l'emplacement</button>
        </div>
      </section>
    </div>
  );
}
