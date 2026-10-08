import { useCallback, useEffect, useState } from 'react';
import { adminAPI, notificationsAPI } from '../../utils/api';
import usePaginated, { useDebounced } from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';
import { useAdminUi } from './ui/AdminUi';
import { Field, PageHeader, StatusBadge, errorText, fieldErrors } from './ui/parts';

const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

function WeekPlanning() {
  const { notify, confirm } = useAdminUi();
  const [days, setDays] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [editing, setEditing] = useState('');
  const [form, setForm] = useState({ text: '', reference: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    notificationsAPI.week()
      .then(({ data }) => { setDays(data); setStatus({ loading: false, error: '' }); })
      .catch((err) => setStatus({ loading: false, error: errorText(err, 'Impossible de charger la semaine.') }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const startEdit = (day) => {
    setEditing(day.date);
    setErrors({});
    setForm({
      text: day.is_override ? day.override_text : day.natural_text,
      reference: day.is_override ? day.override_reference : day.natural_reference,
    });
  };

  const save = async () => {
    if (!form.text.trim() || !form.reference.trim()) {
      setErrors({ text: form.text.trim() ? '' : 'Écrivez le verset.', reference: form.reference.trim() ? '' : 'Indiquez la référence (ex : Jean 3:16).' });
      return;
    }
    setSaving(true);
    try {
      await notificationsAPI.setOverride(editing, form);
      notify('Verset du jour enregistré.');
      setEditing('');
      load();
    } catch (err) {
      setErrors(fieldErrors(err));
      notify(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const clear = async (day) => {
    const accepted = await confirm({
      title: 'Revenir au verset automatique ?',
      message: `Le verset choisi pour le ${longDate(day.date)} sera remplacé par le verset automatique.`,
      confirmLabel: 'Revenir à l’automatique',
    });
    if (!accepted) return;
    try {
      await notificationsAPI.clearOverride(day.date);
      notify('Verset automatique rétabli.');
      load();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  return (
    <>
      <p className="admin-help mb-3">
        Chaque jour, un verset est choisi automatiquement. Vous pouvez le remplacer pour une date précise ; sinon le verset automatique s’applique.
      </p>
      <ListStatus loading={status.loading} error={status.error} onRetry={load} isEmpty={days.length === 0} emptyText="Aucun jour à afficher." rows={4} />
      {days.map((day) => {
        const text = day.is_override ? day.override_text : day.natural_text;
        const reference = day.is_override ? day.override_reference : day.natural_reference;
        return (
          <section className="admin-card" key={day.date}>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <strong className="text-capitalize">{longDate(day.date)}</strong>
                {day.is_override && <> <StatusBadge status="paid" label="Choisi par vous" /></>}
              </div>
              {editing !== day.date && (
                <div className="d-flex gap-2 flex-wrap">
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => startEdit(day)}>Modifier</button>
                  {day.is_override && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => clear(day)}>Revenir à l’automatique</button>}
                </div>
              )}
            </div>
            {editing === day.date ? (
              <div className="mt-3">
                <Field label="Verset" error={errors.text} htmlFor={`v-text-${day.date}`}>
                  <textarea id={`v-text-${day.date}`} rows={3} className="form-control" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
                </Field>
                <Field label="Référence" error={errors.reference} htmlFor={`v-ref-${day.date}`}>
                  <input id={`v-ref-${day.date}`} className="form-control" placeholder="Ex : Proverbes 3:5" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
                </Field>
                <div className="d-flex gap-2 flex-wrap">
                  <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setEditing('')}>Annuler</button>
                </div>
              </div>
            ) : (
              <p className="mb-0 mt-2 fst-italic">« {text} » — {reference}</p>
            )}
          </section>
        );
      })}
    </>
  );
}

function VerseLibrary() {
  const { notify, confirm } = useAdminUi();
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const { items, count, loading, error, page, pageSize, setPage, reload } = usePaginated(
    adminAPI.verseLibrary, debounced ? { search: debounced } : {},
  );
  const [form, setForm] = useState({ text: '', reference: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [epoch, setEpoch] = useState(0);

  const add = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await adminAPI.createVerse(form);
      notify('Verset ajouté à la bibliothèque.');
      setForm({ text: '', reference: '' });
      reload();
    } catch (err) {
      setErrors(fieldErrors(err));
      notify(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const patch = async (verse, data, success) => {
    try {
      await adminAPI.updateVerse(verse.id, data);
      notify(success);
      reload();
    } catch (err) {
      notify(errorText(err), 'error');
      setEpoch((e) => e + 1);
      reload();
    }
  };

  const remove = async (verse) => {
    const accepted = await confirm({ title: `Supprimer ${verse.reference} ?`, message: 'Ce verset ne sera plus proposé.', confirmLabel: 'Supprimer', danger: true });
    if (!accepted) return;
    try {
      await adminAPI.deleteVerse(verse.id);
      notify('Verset supprimé.');
      reload();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  return (
    <>
      <form className="admin-card" onSubmit={add} noValidate>
        <h2 className="admin-card-title">Ajouter un verset</h2>
        <Field label="Verset *" error={errors.text} htmlFor="lib-text">
          <textarea id="lib-text" rows={3} className="form-control" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
        </Field>
        <Field label="Référence *" error={errors.reference} htmlFor="lib-ref">
          <input id="lib-ref" className="form-control" placeholder="Ex : Jean 3:16" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Ajout…' : 'Ajouter'}</button>
      </form>

      <div className="admin-toolbar">
        <input type="search" className="form-control admin-search" placeholder="Chercher un verset ou une référence" aria-label="Chercher un verset" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="cell-muted">{count} verset{count > 1 ? 's' : ''}</span>
      </div>

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={items.length === 0} emptyText="Aucun verset trouvé." />

      {items.map((v) => (
        <div className="variant-card" key={`${v.id}-${epoch}`}>
          <div className="variant-head">
            <strong>{v.reference}</strong>
            <div className="d-flex align-items-center gap-3">
              <div className="form-check form-switch mb-0">
                <input type="checkbox" role="switch" className="form-check-input" id={`v-act-${v.id}`} checked={v.is_active} onChange={() => patch(v, { is_active: !v.is_active }, v.is_active ? 'Verset retiré des tirages.' : 'Verset à nouveau proposé.')} />
                <label className="form-check-label" htmlFor={`v-act-${v.id}`}>Proposé</label>
              </div>
              <button type="button" className="admin-link is-danger" onClick={() => remove(v)}>Supprimer</button>
            </div>
          </div>
          <textarea
            rows={2} className="form-control mb-2" aria-label={`Texte de ${v.reference}`} defaultValue={v.text}
            onBlur={(e) => { if (e.target.value.trim() !== v.text) patch(v, { text: e.target.value }, 'Enregistré.'); }}
          />
          <input
            className="form-control" aria-label={`Référence de ${v.reference}`} defaultValue={v.reference}
            onBlur={(e) => { if (e.target.value.trim() !== v.reference) patch(v, { reference: e.target.value }, 'Enregistré.'); }}
          />
        </div>
      ))}

      <Pager page={page} count={count} pageSize={pageSize} onChange={setPage} />
    </>
  );
}

export default function AdminVersesScreen() {
  const [tab, setTab] = useState('week');
  return (
    <div>
      <PageHeader title="Versets" lead="Le verset du jour affiché sur le site et envoyé en notification." />
      <div className="admin-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'week'} className={tab === 'week' ? 'is-active' : ''} onClick={() => setTab('week')}>Cette semaine</button>
        <button type="button" role="tab" aria-selected={tab === 'library'} className={tab === 'library' ? 'is-active' : ''} onClick={() => setTab('library')}>Bibliothèque</button>
      </div>
      {tab === 'week' ? <WeekPlanning /> : <VerseLibrary />}
    </div>
  );
}
