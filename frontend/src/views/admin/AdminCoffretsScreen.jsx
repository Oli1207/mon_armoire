import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';

export default function AdminCoffretsScreen() {
  const [coffrets, setCoffrets] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', box_price: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    adminAPI.coffrets().then(({ data }) => setCoffrets(data));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await adminAPI.createCoffret({ ...form, box_price: form.box_price || 0 });
      setForm({ name: '', description: '', box_price: '' });
      setShowNew(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coffret) => {
    await adminAPI.updateCoffret(coffret.id, { is_active: !coffret.is_active });
    load();
  };

  const handleDelete = async (coffret) => {
    if (!window.confirm(`Supprimer définitivement « ${coffret.name} » ? Cette action est irréversible.`)) return;
    await adminAPI.deleteCoffret(coffret.id);
    load();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h4 mb-0">Coffrets ({coffrets.length})</h1>
        <button className="btn btn-sm btn-primary" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'Annuler' : '+ Nouveau coffret'}
        </button>
      </div>

      {showNew && (
        <div className="card p-3 mb-4">
          <input
            className="form-control mb-2"
            placeholder="Nom du coffret"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <textarea
            className="form-control mb-2"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            type="number"
            className="form-control mb-2"
            placeholder="Prix du contenant (FCFA)"
            value={form.box_price}
            onChange={(e) => setForm({ ...form, box_price: e.target.value })}
          />
          <button className="btn btn-sm btn-primary" disabled={saving || !form.name} onClick={handleCreate}>
            {saving ? 'Création...' : 'Créer le coffret'}
          </button>
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-sm align-middle bg-white">
          <thead>
            <tr>
              <th></th>
              <th>Nom</th>
              <th>Prix de départ</th>
              <th>Contenu inclus</th>
              <th>Emplacements</th>
              <th>Actif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {coffrets.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.image ? (
                    <img src={c.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                  ) : (
                    <div className="bg-white border" style={{ width: 40, height: 40, borderRadius: 4 }} />
                  )}
                </td>
                <td>{c.name}</td>
                <td>{Number(c.starting_price).toLocaleString('fr-FR')} FCFA</td>
                <td>{c.included_items.length}</td>
                <td>{c.slots.length}</td>
                <td>
                  <button
                    className={`btn btn-sm ${c.is_active ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => toggleActive(c)}
                  >
                    {c.is_active ? 'Actif' : 'Inactif'}
                  </button>
                </td>
                <td className="d-flex gap-2">
                  <Link className="btn btn-sm btn-link" to={`/admin/coffrets/${c.id}`}>Gérer</Link>
                  <button className="btn btn-sm btn-link text-danger" onClick={() => handleDelete(c)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
