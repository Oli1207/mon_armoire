import { useCallback, useEffect, useMemo, useState } from 'react';
import ListStatus from '../../../components/ListStatus';
import { useAdminUi } from './AdminUi';
import { Field, ImageField, PageHeader, errorText, fieldErrors } from './parts';

/**
 * Écran de gestion générique (liste + formulaire d'ajout/modification + suppression) :
 * garantit la même présentation, les mêmes retours et les mêmes protections sur tous les écrans de contenu.
 *
 * fields : [{ name, label, type: text|textarea|number|checkbox|select|multi|image, help, required, optionsKey, options, step }]
 * columns : [{ label, render(item) }]
 */
export default function AdminCrud({
  kicker, title, lead, newLabel = 'Ajouter', emptyText = 'Rien pour le moment.',
  api, fields, columns, itemName, deleteWarning, loadOptions, defaults = {}, thumb,
}) {
  const { notify, confirm } = useAdminUi();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [options, setOptions] = useState({});
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const [form, setForm] = useState({});
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const emptyForm = useMemo(() => {
    const base = {};
    fields.forEach((f) => {
      if (f.type === 'checkbox') base[f.name] = true;
      else if (f.type === 'multi') base[f.name] = [];
      else base[f.name] = '';
    });
    return { ...base, ...defaults };
  }, [fields, defaults]);

  const load = useCallback(() => {
    setStatus({ loading: true, error: '' });
    api.list()
      .then(({ data }) => { setItems(Array.isArray(data) ? data : data.results); setStatus({ loading: false, error: '' }); })
      .catch((err) => setStatus({ loading: false, error: errorText(err, 'Impossible de charger la liste.') }));
  }, [api]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadOptions?.().then(setOptions).catch(() => {}); }, [loadOptions]);

  const openNew = () => { setEditing('new'); setForm(emptyForm); setFiles({}); setErrors({}); };

  const openEdit = (item) => {
    const values = {};
    fields.forEach((f) => {
      if (f.type === 'image') values[f.name] = '';
      else if (f.type === 'multi') values[f.name] = (item[f.name] || []).map(String);
      else values[f.name] = item[f.name] ?? '';
    });
    setEditing(item.id); setForm(values); setFiles({}); setErrors({});
  };

  const close = () => { setEditing(null); setErrors({}); };

  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const buildPayload = () => {
    const hasFile = fields.some((f) => f.type === 'image' && files[f.name]);
    if (!hasFile) {
      const data = {};
      fields.forEach((f) => {
        if (f.type === 'image') return;
        const value = form[f.name];
        if (f.type === 'number') data[f.name] = value === '' ? null : value;
        else if (f.type === 'select' && value === '') data[f.name] = null;
        else data[f.name] = value;
      });
      return data;
    }
    const data = new FormData();
    fields.forEach((f) => {
      if (f.type === 'image') { if (files[f.name]) data.append(f.name, files[f.name]); return; }
      const value = form[f.name];
      if (f.type === 'multi') value.forEach((v) => data.append(f.name, v));
      else if (f.type === 'checkbox') data.append(f.name, value ? 'true' : 'false');
      else if (value !== '' && value !== null) data.append(f.name, value);
    });
    return data;
  };

  const submit = async (event) => {
    event.preventDefault();
    const missing = fields.filter((f) => f.required && f.type !== 'image' && (form[f.name] === '' || form[f.name] == null));
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((f) => [f.name, 'Ce champ est obligatoire.'])));
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      if (editing === 'new') await api.create(buildPayload());
      else await api.update(editing, buildPayload());
      notify(editing === 'new' ? 'Ajouté.' : 'Modifications enregistrées.');
      close();
      load();
    } catch (err) {
      const byField = fieldErrors(err);
      const known = Object.keys(byField).filter((k) => fields.some((f) => f.name === k));
      setErrors(byField);
      if (!known.length) notify(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    const accepted = await confirm({
      title: `Supprimer « ${itemName(item)} » ?`,
      message: deleteWarning || 'Cette action est définitive.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!accepted) return;
    try {
      await api.remove(item.id);
      notify('Supprimé.');
      load();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  const optionsFor = (field) => field.options || options[field.optionsKey || field.name] || [];

  const renderField = (field) => {
    const id = `crud-${field.name}`;
    const common = { id, className: 'form-control', value: form[field.name] ?? '', onChange: (e) => set(field.name, e.target.value) };
    let control;
    if (field.type === 'textarea') control = <textarea rows={field.rows || 4} {...common} />;
    else if (field.type === 'number') control = <input type="number" inputMode="decimal" min={field.min ?? 0} step={field.step || 1} {...common} />;
    else if (field.type === 'select') {
      control = (
        <select {...common} className="form-select">
          <option value="">{field.emptyLabel || '— Aucun —'}</option>
          {optionsFor(field).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else if (field.type === 'checkbox') {
      return (
        <div className="admin-field" key={field.name}>
          <div className="form-check">
            <input id={id} type="checkbox" className="form-check-input" checked={!!form[field.name]} onChange={(e) => set(field.name, e.target.checked)} />
            <label className="form-check-label" htmlFor={id}>{field.label}</label>
          </div>
          {field.help && <p className="admin-help">{field.help}</p>}
        </div>
      );
    } else if (field.type === 'multi') {
      control = (
        <div className="admin-check-list">
          {optionsFor(field).map((o) => {
            const value = String(o.value);
            const checked = form[field.name].includes(value);
            return (
              <div className="form-check" key={value}>
                <input
                  id={`${id}-${value}`} type="checkbox" className="form-check-input" checked={checked}
                  onChange={() => set(field.name, checked ? form[field.name].filter((v) => v !== value) : [...form[field.name], value])}
                />
                <label className="form-check-label" htmlFor={`${id}-${value}`}>{o.label}</label>
              </div>
            );
          })}
          {!optionsFor(field).length && <span className="admin-help">Aucun choix disponible pour le moment.</span>}
        </div>
      );
    } else if (field.type === 'image') {
      const current = editing && editing !== 'new' ? items.find((i) => i.id === editing)?.[field.name] : null;
      return (
        <ImageField
          key={field.name} label={field.label} help={field.help} value={current} file={files[field.name]}
          onChange={(file) => setFiles((c) => ({ ...c, [field.name]: file }))}
          onProblem={(message) => notify(message, 'error')}
          error={errors[field.name]}
        />
      );
    } else control = <input type="text" {...common} />;

    return (
      <Field key={field.name} label={`${field.label}${field.required ? ' *' : ''}`} help={field.help} error={errors[field.name]} htmlFor={id}>
        {control}
      </Field>
    );
  };

  const half = fields.filter((f) => ['text', 'number', 'select'].includes(f.type));
  const others = fields.filter((f) => !['text', 'number', 'select'].includes(f.type));

  return (
    <div>
      <PageHeader kicker={kicker} title={title} lead={lead}>
        {!editing && <button type="button" className="btn btn-primary" onClick={openNew}>+ {newLabel}</button>}
      </PageHeader>

      {editing && (
        <form className="admin-card" onSubmit={submit} noValidate>
          <h2 className="admin-card-title">{editing === 'new' ? newLabel : 'Modifier'}</h2>
          <div className="admin-grid cols-2">{half.map(renderField)}</div>
          {others.map(renderField)}
          <div className="d-flex gap-2 flex-wrap mt-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            <button type="button" className="btn btn-outline-secondary" onClick={close} disabled={saving}>Annuler</button>
          </div>
        </form>
      )}

      <ListStatus loading={status.loading} error={status.error} onRetry={load} isEmpty={items.length === 0} emptyText={emptyText} rows={3} />

      {items.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {thumb && <th aria-label="Photo" />}
                {columns.map((c) => <th key={c.label}>{c.label}</th>)}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  {thumb && (
                    <td>{thumb(item) ? <img className="admin-thumb" src={thumb(item)} alt="" loading="lazy" /> : <span className="admin-thumb admin-thumb-empty" />}</td>
                  )}
                  {columns.map((c) => <td key={c.label}>{c.render(item)}</td>)}
                  <td className="cell-actions">
                    <button type="button" className="admin-link" onClick={() => openEdit(item)}>Modifier</button>
                    <button type="button" className="admin-link is-danger" onClick={() => remove(item)}>Supprimer</button>
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
