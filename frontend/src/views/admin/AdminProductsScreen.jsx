import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';
import { useAdminUi } from './ui/AdminUi';
import { Field, PageHeader, StatusBadge, errorText, fcfa, fieldErrors } from './ui/parts';

export default function AdminProductsScreen() {
  const { notify, confirm } = useAdminUi();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', description: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const debounced = useDebounced(search.trim());
  const { items: products, count, loading, error, page, pageSize, setPage, reload } = usePaginated(
    adminAPI.products, debounced ? { search: debounced } : {},
  );

  useEffect(() => { adminAPI.categories().then(({ data }) => setCategories(data)).catch(() => {}); }, []);

  const create = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) { setErrors({ name: 'Donnez un nom au produit.' }); return; }
    setSaving(true);
    setErrors({});
    try {
      const { data } = await adminAPI.createProduct({ ...form, category: form.category || null });
      notify('Produit créé. Ajoutez maintenant ses photos et ses variantes.');
      navigate(`/admin/produits/${data.id}`);
    } catch (err) {
      setErrors(fieldErrors(err));
      notify(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product) => {
    try {
      await adminAPI.updateProduct(product.id, { is_active: !product.is_active });
      notify(product.is_active ? `« ${product.name} » n'est plus visible sur le site.` : `« ${product.name} » est visible sur le site.`);
      reload();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  const remove = async (product) => {
    const accepted = await confirm({
      title: `Supprimer « ${product.name} » ?`,
      message: 'Le produit, ses photos et ses variantes seront supprimés définitivement. Pour simplement le cacher, utilisez l’interrupteur « Visible ».',
      confirmLabel: 'Supprimer', danger: true,
    });
    if (!accepted) return;
    try {
      await adminAPI.deleteProduct(product.id);
      notify('Produit supprimé.');
      reload();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Produits" lead={`${count} produit${count > 1 ? 's' : ''}. Un produit caché n'apparaît plus sur le site mais reste ici.`}>
        <button type="button" className="btn btn-primary" onClick={() => setShowNew((v) => !v)}>{showNew ? 'Annuler' : '+ Nouveau produit'}</button>
      </PageHeader>

      {showNew && (
        <form className="admin-card" onSubmit={create} noValidate>
          <h2 className="admin-card-title">Nouveau produit</h2>
          <div className="admin-grid cols-2">
            <Field label="Nom du produit *" error={errors.name} htmlFor="new-name">
              <input id="new-name" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Catégorie" htmlFor="new-category" help="Vous pourrez la changer plus tard.">
              <select id="new-category" className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">— Aucune —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description" htmlFor="new-description">
            <textarea id="new-description" rows={3} className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Création…' : 'Créer et continuer'}</button>
        </form>
      )}

      <div className="admin-toolbar">
        <input
          type="search" className="form-control admin-search" placeholder="Chercher un produit ou une catégorie"
          aria-label="Chercher un produit" value={search} onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={products.length === 0} emptyText="Aucun produit trouvé." />

      {products.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th aria-label="Photo" /><th>Produit</th><th>Prix</th><th>Stock</th><th>Visible</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const image = p.images.find((i) => i.is_main) || p.images[0];
                const prices = p.variants.map((v) => Number(v.price));
                const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
                return (
                  <tr key={p.id}>
                    <td>{image ? <img className="admin-thumb" src={image.thumbnail || image.image} alt="" loading="lazy" /> : <span className="admin-thumb admin-thumb-empty" />}</td>
                    <td>
                      <Link to={`/admin/produits/${p.id}`}><strong>{p.name}</strong></Link>
                      <div className="cell-muted">{p.category_name || 'Sans catégorie'} · {p.variants.length} variante{p.variants.length > 1 ? 's' : ''}</div>
                    </td>
                    <td>{prices.length ? (Math.min(...prices) === Math.max(...prices) ? fcfa(prices[0]) : `dès ${fcfa(Math.min(...prices))}`) : <span className="cell-muted">—</span>}</td>
                    <td>{p.variants.length ? (stock > 0 ? stock : <StatusBadge status="cancelled" label="Rupture" />) : '—'}</td>
                    <td>
                      <div className="form-check form-switch mb-0">
                        <input
                          type="checkbox" role="switch" className="form-check-input" checked={p.is_active}
                          aria-label={`${p.name} visible sur le site`} onChange={() => toggleActive(p)}
                        />
                      </div>
                    </td>
                    <td className="cell-actions">
                      <Link className="admin-link" to={`/admin/produits/${p.id}`}>Modifier</Link>
                      <button type="button" className="admin-link is-danger" onClick={() => remove(p)}>Supprimer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} count={count} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}
