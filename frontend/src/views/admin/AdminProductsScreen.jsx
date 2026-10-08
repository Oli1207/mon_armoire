import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';

export default function AdminProductsScreen() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState('');
  const debounced = useDebounced(search.trim());
  const { items: products, count, loading, error: loadError, page, pageSize, setPage, reload: load } = usePaginated(
    adminAPI.products, debounced ? { search: debounced } : {},
  );
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', description: '', symbolic_meaning: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminAPI.categories().then(({ data }) => setCategories(data));
  }, []);

  const handleCreate = async () => {
    setError('');
    setSaving(true);
    try {
      await adminAPI.createProduct(form);
      setForm({ name: '', category: '', description: '', symbolic_meaning: '' });
      setShowNew(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product) => {
    setActionError('');
    try {
      await adminAPI.updateProduct(product.id, { is_active: !product.is_active });
      load();
    } catch {
      setActionError('Impossible de modifier ce produit. Veuillez réessayer.');
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Supprimer définitivement « ${product.name} » ? Cette action est irréversible.`)) return;
    setActionError('');
    try {
      await adminAPI.deleteProduct(product.id);
      load();
    } catch {
      setActionError('Impossible de supprimer ce produit (il est peut-être utilisé dans un coffret).');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h4 mb-0">Produits ({count})</h1>
        <button className="btn btn-sm btn-primary" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'Annuler' : '+ Nouveau produit'}
        </button>
      </div>

      {showNew && (
        <div className="card p-3 mb-4">
          <input
            className="form-control mb-2"
            placeholder="Nom du produit"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="form-select mb-2"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="">Catégorie...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <textarea
            className="form-control mb-2"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <textarea
            className="form-control mb-2"
            placeholder="Signification symbolique"
            value={form.symbolic_meaning}
            onChange={(e) => setForm({ ...form, symbolic_meaning: e.target.value })}
          />
          {error && <div className="alert alert-danger">{error}</div>}
          <button className="btn btn-sm btn-primary" disabled={saving || !form.name} onClick={handleCreate}>
            {saving ? 'Création...' : 'Créer le produit'}
          </button>
        </div>
      )}

      <input
        type="search"
        className="form-control mb-3"
        style={{ maxWidth: '24rem' }}
        placeholder="Chercher un produit ou une catégorie"
        aria-label="Chercher un produit"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {actionError && <div className="alert alert-danger" role="alert">{actionError}</div>}
      <ListStatus loading={loading} error={loadError} onRetry={load} isEmpty={products.length === 0} emptyText="Aucun produit trouvé." />

      <div className="table-responsive">
        <table className="table table-sm align-middle bg-white">
          <thead>
            <tr>
              <th></th>
              <th>Nom</th>
              <th>Catégorie</th>
              <th>Variantes</th>
              <th>Actif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const image = p.images.find((i) => i.is_main)?.image || p.images[0]?.image;
              return (
              <tr key={p.id}>
                <td>
                  {image ? (
                    <img src={image} alt="" width="40" height="40" loading="lazy" style={{ objectFit: 'cover', borderRadius: 4 }} />
                  ) : (
                    <div className="bg-white border" style={{ width: 40, height: 40, borderRadius: 4 }} />
                  )}
                </td>
                <td>{p.name}</td>
                <td>{p.category_name || '—'}</td>
                <td>{p.variants.length}</td>
                <td>
                  <button
                    className={`btn btn-sm ${p.is_active ? 'btn-success' : 'btn-outline-secondary'}`}
                    onClick={() => toggleActive(p)}
                  >
                    {p.is_active ? 'Actif' : 'Inactif'}
                  </button>
                </td>
                <td className="d-flex gap-2">
                  <Link className="btn btn-sm btn-link" to={`/admin/produits/${p.id}`}>Gérer</Link>
                  <button className="btn btn-sm btn-link text-danger" onClick={() => handleDelete(p)}>Supprimer</button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pager page={page} count={count} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}
