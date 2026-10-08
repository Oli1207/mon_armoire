import { useCallback, useEffect, useState } from 'react';
import { adminAPI } from '../../utils/api';
import ListStatus from '../../components/ListStatus';
import { useAdminUi } from './ui/AdminUi';
import { Field, PageHeader, StatusBadge, errorText, fieldErrors } from './ui/parts';

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'jamais');

function MemberCard({ member, meta, onChange, onReload }) {
  const { notify, confirm } = useAdminUi();
  const [open, setOpen] = useState(false);
  const roleInfo = meta.roles.find((r) => r.key === member.role);

  const save = async (data, success) => {
    try {
      await adminAPI.updateMember(member.id, data);
      notify(success);
      onChange();
    } catch (err) {
      notify(errorText(err), 'error');
      onReload();
    }
  };

  const togglePermission = (perm, checked) => {
    const next = Object.fromEntries(meta.permissions.map((p) => [p.key, member.permissions.includes(p.key)]));
    next[perm] = checked;
    save({ extra_permissions: next }, 'Droits enregistrés.');
  };

  const invite = async () => {
    try {
      const { data } = await adminAPI.inviteMember(member.id);
      notify(data.message);
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  const remove = async () => {
    const accepted = await confirm({
      title: `Retirer ${member.full_name || member.email} de l’équipe ?`,
      message: 'Cette personne ne pourra plus ouvrir l’Admin. Son compte client (commandes, favoris) n’est pas supprimé. Vous pourrez la réinviter plus tard.',
      confirmLabel: 'Retirer de l’équipe', danger: true,
    });
    if (!accepted) return;
    try {
      await adminAPI.deleteMember(member.id);
      notify('Personne retirée de l’équipe.');
      onChange();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  return (
    <section className="admin-card">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <strong>{member.full_name || member.email}</strong>
          {member.full_name && <div className="cell-muted">{member.email}</div>}
          <div className="cell-muted">Dernière connexion : {formatDate(member.last_login)}</div>
        </div>
        <div>
          {!member.is_active
            ? <StatusBadge status="cancelled" label="Accès suspendu" />
            : !member.has_password
              ? <StatusBadge status="pending" label="Invitation envoyée" />
              : <StatusBadge status="paid" label="Accès actif" />}
        </div>
      </div>

      <div className="admin-grid cols-2 mt-3">
        <Field label="Rôle" htmlFor={`role-${member.id}`} help={roleInfo?.description}>
          <select
            id={`role-${member.id}`} className="form-select" value={member.role}
            onChange={(e) => save({ role: e.target.value }, 'Rôle modifié. Les droits ont été remis au standard de ce rôle.')}
          >
            {meta.roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </Field>
      </div>

      <button type="button" className="admin-link" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? 'Masquer le détail des droits' : 'Voir / ajuster ses droits un par un'}
      </button>
      {open && (
        <div className="mb-2">
          <p className="admin-help">Cochez ce que cette personne peut faire. Les changements sont enregistrés tout de suite.</p>
          {meta.permissions.map((p) => (
            <div className="form-check mb-1" key={p.key}>
              <input
                id={`perm-${member.id}-${p.key}`} type="checkbox" className="form-check-input"
                checked={member.permissions.includes(p.key)} onChange={(e) => togglePermission(p.key, e.target.checked)}
              />
              <label className="form-check-label" htmlFor={`perm-${member.id}-${p.key}`}>{p.label}</label>
            </div>
          ))}
        </div>
      )}

      <div className="d-flex gap-2 flex-wrap mt-3">
        {!member.has_password && <button type="button" className="btn btn-outline-primary btn-sm" onClick={invite}>Renvoyer l’invitation</button>}
        {member.is_active
          ? <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => save({ is_active: false }, 'Accès suspendu : cette personne ne peut plus rien faire dans l’Admin.')}>Suspendre l’accès</button>
          : <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => save({ is_active: true }, 'Accès rétabli.')}>Rétablir l’accès</button>}
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={remove}>Retirer de l’équipe</button>
      </div>
    </section>
  );
}

export default function AdminTeamScreen() {
  const { notify } = useAdminUi();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [form, setForm] = useState({ full_name: '', email: '', role: 'orders' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    adminAPI.team()
      .then(({ data: payload }) => { setData(payload); setStatus({ loading: false, error: '' }); })
      .catch((err) => setStatus({ loading: false, error: errorText(err, 'Impossible de charger l’équipe.') }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const invite = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await adminAPI.createMember(form);
      notify('Invitation envoyée par e-mail. La personne choisit elle-même son mot de passe.');
      setForm({ full_name: '', email: '', role: form.role });
      load();
    } catch (err) {
      setErrors(fieldErrors(err));
      notify(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div><PageHeader title="Équipe" /><ListStatus loading={status.loading} error={status.error} onRetry={load} isEmpty rows={3} /></div>;

  const selectedRole = data.roles.find((r) => r.key === form.role);

  return (
    <div>
      <PageHeader
        kicker="Propriétaire" title="Équipe"
        lead="Donnez accès à l’Admin à vos collaboratrices. Chacune se connecte avec sa propre adresse e-mail et ne voit que ce que son rôle permet. Tout ce qu’elles font est noté dans le Journal."
      />

      <form className="admin-card" onSubmit={invite} noValidate>
        <h2 className="admin-card-title">Inviter une personne</h2>
        <ol className="admin-help">
          <li>Saisissez son adresse e-mail et choisissez son rôle.</li>
          <li>Elle reçoit un e-mail avec un lien (valable 1 heure) pour choisir son mot de passe.</li>
          <li>Elle se connecte ensuite sur le site, puis ouvre « Admin » dans le menu.</li>
        </ol>
        <div className="admin-grid cols-2">
          <Field label="Prénom et nom (facultatif)" htmlFor="t-name">
            <input id="t-name" className="form-control" autoComplete="off" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Adresse e-mail *" htmlFor="t-email" error={errors.email}>
            <input id="t-email" type="email" inputMode="email" autoComplete="off" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
        </div>
        <Field label="Rôle *" htmlFor="t-role" error={errors.role} help={selectedRole?.description}>
          <select id="t-role" className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {data.roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </Field>
        <button type="submit" className="btn btn-primary" disabled={saving || !form.email.trim()}>{saving ? 'Envoi…' : 'Envoyer l’invitation'}</button>
      </form>

      <h2 className="admin-card-title mt-4">Propriétaire{data.owners.length > 1 ? 's' : ''}</h2>
      {data.owners.map((o) => (
        <section className="admin-card" key={o.email}>
          <strong>{o.full_name || o.email}</strong> <StatusBadge status="paid" label="Tous les droits" />
          {o.full_name && <div className="cell-muted">{o.email}</div>}
          <div className="cell-muted">Dernière connexion : {formatDate(o.last_login)}</div>
        </section>
      ))}

      <h2 className="admin-card-title mt-4">Membres de l’équipe ({data.members.length})</h2>
      {data.members.length === 0 && <p className="text-muted">Personne pour le moment. Invitez votre première collaboratrice ci-dessus.</p>}
      {data.members.map((m) => <MemberCard key={m.id} member={m} meta={data} onChange={load} onReload={load} />)}
    </div>
  );
}
