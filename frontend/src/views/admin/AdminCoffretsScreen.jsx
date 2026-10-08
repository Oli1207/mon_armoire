import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminAPI } from '../../utils/api';
import ListStatus from '../../components/ListStatus';
import { useAdminUi } from './ui/AdminUi';
import { Field, PageHeader, errorText, fcfa, fieldErrors } from './ui/parts';

export default function AdminCoffretsScreen() {
  const { notify, confirm } = useAdminUi();
  const navigate = useNavigate();
  const [coffrets, setCoffrets] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', box_price: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setStatus({ loading: true, error: '' });
    adminAPI.coffrets()
      .then(({ data }) => { setCoffrets(data); setStatus({ loading: false, error: '' }); })
      .catch((err) => setStatus({ loading: false, error: errorText(err, 'Impossible de charger les coffrets.') }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) { setErrors({ name: 'Donnez un nom au coffret.' }); return; }
    setSaving(true);
    setErrors({});
    try {
      const { data } = await adminAPI.createCoffret({ ...form, box_price: form.box_price || 0 });
      notify('Coffret créé. Composez-le maintenant.');
      navigate(`/admin/coffrets/${data.id}`);
    } catch (err) {
      setErrors(fieldErrors(err));
      notify(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coffret) => {
    try {
      await adminAPI.updateCoffret(coffret.id, { is_active: !coffret.is_active });
      notify(coffret.is_active ? 'Coffret caché du site.' : 'Coffret visible sur le site.');
      load();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  const remove = async (coffret) => {
    const accepted = await confirm({
      title: `Supprimer « ${coffret.name} » ?`,
      message: 'Si des clientes l’ont déjà mis dans un panier ou commandé, la suppression sera refusée : cachez-le plutôt.',
      confirmLabel: 'Supprimer', danger: true,
    });
    if (!accepted) return;
    try {
      await adminAPI.deleteCoffret(coffret.id);
      notify('Coffret supprimé.');
      load();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Coffrets" lead="Les coffrets cadeaux : un contenant, des articles déjà inclus et, si vous le souhaitez, des choix laissés à la cliente.">
        <button type="button" className="btn btn-primary" onClick={() => setShowNew((v) => !v)}>{showNew ? 'Annuler' : '+ Nouveau coffret'}</button>
      </PageHeader>

      {showNew && (
        <form className="admin-card" onSubmit={create} noValidate>
          <h2 className="admin-card-title">Nouveau coffret</h2>
          <div className="admin-grid cols-2">
            <Field label="Nom du coffret *" error={errors.name} htmlFor="c-name">
              <input id="c-name" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Prix du contenant (FCFA)" help="Le prix de la boîte seule, sans les articles." htmlFor="c-price" error={errors.box_price}>
              <input id="c-price" type="number" min="0" step="100" inputMode="numeric" className="form-control" value={form.box_price} onChange={(e) => setForm({ ...form, box_price: e.target.value })} />
            </Field>
          </div>
          <Field label="Description" htmlFor="c-desc">
            <textarea id="c-desc" rows={3} className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Création…' : 'Créer et composer'}</button>
        </form>
      )}

      <ListStatus loading={status.loading} error={status.error} onRetry={load} isEmpty={coffrets.length === 0} emptyText="Aucun coffret pour le moment." rows={3} />

      {coffrets.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th aria-label="Photo" /><th>Coffret</th><th>Prix de départ</th><th>Articles inclus</th><th>Choix cliente</th><th>Visible</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {coffrets.map((c) => (
                <tr key={c.id}>
                  <td>{c.image ? <img className="admin-thumb" src={c.image} alt="" loading="lazy" /> : <span className="admin-thumb admin-thumb-empty" />}</td>
                  <td><Link to={`/admin/coffrets/${c.id}`}><strong>{c.name}</strong></Link></td>
                  <td>{fcfa(c.starting_price)}</td>
                  <td>{c.included_items.length}</td>
                  <td>{c.slots.length ? `${c.slots.length} emplacement${c.slots.length > 1 ? 's' : ''}` : <span className="cell-muted">aucun</span>}</td>
                  <td>
                    <div className="form-check form-switch mb-0">
                      <input type="checkbox" role="switch" className="form-check-input" checked={c.is_active} aria-label={`${c.name} visible sur le site`} onChange={() => toggleActive(c)} />
                    </div>
                  </td>
                  <td className="cell-actions">
                    <Link className="admin-link" to={`/admin/coffrets/${c.id}`}>Composer</Link>
                    <button type="button" className="admin-link is-danger" onClick={() => remove(c)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
