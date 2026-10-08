import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';

export default function AdminCoffretDetailScreen() {
  const { id } = useParams();
  const [coffret, setCoffret] = useState(null);
  const [categories, setCategories] = useState([]);
  const [variantOptions, setVariantOptions] = useState([]);
  const [newSlot, setNewSlot] = useState({ label: '', allowed_category: '', min_select: 1, max_select: 1 });
  const [newItem, setNewItem] = useState({ variant_id: '', quantity: 1 });

  const load = () => {
    adminAPI.coffretDetail(id).then(({ data }) => setCoffret(data));
  };

  useEffect(() => {
    load();
    adminAPI.categories().then(({ data }) => setCategories(data));
    adminAPI.variantOptions().then(({ data }) => setVariantOptions(data));
  }, [id]);

  const handleFieldSave = async (field, value) => {
    await adminAPI.updateCoffret(id, { [field]: value });
    load();
  };

  const handleAddSlot = async () => {
    await adminAPI.createSlot(id, newSlot);
    setNewSlot({ label: '', allowed_category: '', min_select: 1, max_select: 1 });
    load();
  };

  const handleSlotChange = async (slotId, field, value) => {
    await adminAPI.updateSlot(slotId, { [field]: value });
    load();
  };

  const handleDeleteSlot = async (slotId) => {
    await adminAPI.deleteSlot(slotId);
    load();
  };

  const handleAddItem = async () => {
    if (!newItem.variant_id) return;
    await adminAPI.createCoffretItem(id, newItem);
    setNewItem({ variant_id: '', quantity: 1 });
    load();
  };

  const handleItemChange = async (itemId, field, value) => {
    await adminAPI.updateCoffretItem(itemId, { [field]: value });
    load();
  };

  const handleDeleteItem = async (itemId) => {
    await adminAPI.deleteCoffretItem(itemId);
    load();
  };

  if (!coffret) return <p>Chargement...</p>;

  return (
    <div>
      <Link to="/admin/coffrets" className="d-block mb-3">← Retour aux coffrets</Link>
      <h1 className="h4 mb-4">{coffret.name}</h1>

      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <label className="form-label small">Nom</label>
          <input className="form-control mb-2" defaultValue={coffret.name} onBlur={(e) => handleFieldSave('name', e.target.value)} />
          <label className="form-label small">Description</label>
          <textarea className="form-control mb-2" defaultValue={coffret.description} onBlur={(e) => handleFieldSave('description', e.target.value)} />
          <label className="form-label small">Prix du contenant</label>
          <input type="number" className="form-control mb-2" defaultValue={coffret.box_price} onBlur={(e) => handleFieldSave('box_price', e.target.value)} />
          <p className="text-muted small mb-0">
            Prix de départ (contenant + éléments inclus) : <strong>{Number(coffret.starting_price).toLocaleString('fr-FR')} FCFA</strong>
          </p>
        </div>

        <div className="col-md-6">
          <h6>Comportement côté cliente</h6>
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="showContents"
              checked={coffret.show_contents}
              onChange={(e) => handleFieldSave('show_contents', e.target.checked)}
            />
            <label className="form-check-label" htmlFor="showContents">
              La cliente voit le détail du contenu
            </label>
          </div>
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="showPrices"
              checked={coffret.show_item_prices}
              disabled={!coffret.show_contents}
              onChange={(e) => handleFieldSave('show_item_prices', e.target.checked)}
            />
            <label className="form-check-label" htmlFor="showPrices">
              Afficher le prix de chaque élément (sinon seul le total du coffret est visible)
            </label>
          </div>
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="allowCustom"
              checked={coffret.allow_customization}
              disabled={!coffret.show_contents}
              onChange={(e) => handleFieldSave('allow_customization', e.target.checked)}
            />
            <label className="form-check-label" htmlFor="allowCustom">
              La cliente peut retirer des éléments inclus ou en ajouter d'autres
            </label>
          </div>
          <p className="text-muted small mb-0">
            Astuce : contenu masqué = coffret « surprise » à prix fixe. Contenu visible + personnalisation désactivée
            = composition figée mais transparente (ex. coffret de Noël annoncé à 180 000 FCFA).
          </p>
        </div>
      </div>

      <h6>Contenu inclus par défaut</h6>
      <table className="table table-sm bg-white">
        <thead>
          <tr>
            <th>Article</th>
            <th>Quantité</th>
            <th>Prix unitaire</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {coffret.included_items.map((item) => (
            <tr key={item.id}>
              <td>{item.product_name} <span className="text-muted small">({item.variant.label})</span></td>
              <td>
                <input
                  type="number"
                  min="1"
                  className="form-control form-control-sm"
                  defaultValue={item.quantity}
                  onBlur={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                  style={{ width: 80 }}
                />
              </td>
              <td className="small text-muted">{Number(item.variant.price).toLocaleString('fr-FR')} FCFA</td>
              <td><button className="btn btn-sm btn-link text-danger" onClick={() => handleDeleteItem(item.id)}>Supprimer</button></td>
            </tr>
          ))}
          <tr>
            <td>
              <select
                className="form-select form-select-sm"
                value={newItem.variant_id}
                onChange={(e) => setNewItem({ ...newItem, variant_id: e.target.value })}
              >
                <option value="">Choisir un article...</option>
                {variantOptions.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            </td>
            <td>
              <input
                type="number"
                min="1"
                className="form-control form-control-sm"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                style={{ width: 80 }}
              />
            </td>
            <td></td>
            <td><button className="btn btn-sm btn-primary" onClick={handleAddItem}>Ajouter</button></td>
          </tr>
        </tbody>
      </table>

      <h6 className="mt-4">Emplacements à choisir par la cliente</h6>
      <table className="table table-sm bg-white">
        <thead>
          <tr>
            <th>Libellé</th>
            <th>Catégorie autorisée</th>
            <th>Min</th>
            <th>Max</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {coffret.slots.map((s) => (
            <tr key={s.id}>
              <td><input className="form-control form-control-sm" defaultValue={s.label} onBlur={(e) => handleSlotChange(s.id, 'label', e.target.value)} /></td>
              <td>
                <select
                  className="form-select form-select-sm"
                  defaultValue={s.allowed_category || ''}
                  onChange={(e) => handleSlotChange(s.id, 'allowed_category', e.target.value)}
                >
                  <option value="">Toutes catégories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </td>
              <td><input type="number" className="form-control form-control-sm" defaultValue={s.min_select} onBlur={(e) => handleSlotChange(s.id, 'min_select', e.target.value)} style={{ width: 70 }} /></td>
              <td><input type="number" className="form-control form-control-sm" defaultValue={s.max_select} onBlur={(e) => handleSlotChange(s.id, 'max_select', e.target.value)} style={{ width: 70 }} /></td>
              <td><button className="btn btn-sm btn-link text-danger" onClick={() => handleDeleteSlot(s.id)}>Supprimer</button></td>
            </tr>
          ))}
          <tr>
            <td><input className="form-control form-control-sm" placeholder="Ex: Choisissez un collier" value={newSlot.label} onChange={(e) => setNewSlot({ ...newSlot, label: e.target.value })} /></td>
            <td>
              <select
                className="form-select form-select-sm"
                value={newSlot.allowed_category}
                onChange={(e) => setNewSlot({ ...newSlot, allowed_category: e.target.value })}
              >
                <option value="">Toutes catégories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </td>
            <td><input type="number" className="form-control form-control-sm" value={newSlot.min_select} onChange={(e) => setNewSlot({ ...newSlot, min_select: e.target.value })} style={{ width: 70 }} /></td>
            <td><input type="number" className="form-control form-control-sm" value={newSlot.max_select} onChange={(e) => setNewSlot({ ...newSlot, max_select: e.target.value })} style={{ width: 70 }} /></td>
            <td><button className="btn btn-sm btn-primary" disabled={!newSlot.label} onClick={handleAddSlot}>Ajouter</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
