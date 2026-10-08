import { useEffect, useState } from 'react';
import { notificationsAPI } from '../../utils/api';

export default function AdminVersesScreen() {
  const [days, setDays] = useState([]);
  const [editing, setEditing] = useState('');
  const [form, setForm] = useState({ text: '', reference: '' });
  const [saving, setSaving] = useState(false);

  const load = () => {
    notificationsAPI.week().then(({ data }) => setDays(data));
  };

  useEffect(load, []);

  const startEdit = (day) => {
    setEditing(day.date);
    setForm({
      text: day.is_override ? day.override_text : day.natural_text,
      reference: day.is_override ? day.override_reference : day.natural_reference,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await notificationsAPI.setOverride(editing, form);
      setEditing('');
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (date) => {
    await notificationsAPI.clearOverride(date);
    load();
  };

  return (
    <div>
      <h1 className="h4 mb-2">Versets de la semaine</h1>
      <p className="text-muted small mb-4">
        Un verset naturel est choisi automatiquement chaque jour. Tu peux le remplacer pour une date précise —
        si tu ne fais rien, le verset naturel s'applique.
      </p>

      {days.map((day) => (
        <div className="card p-3 mb-2" key={day.date}>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <strong>{new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
              {day.is_override && <span className="badge badge-gold ms-2">Personnalisé</span>}
            </div>
            <div className="d-flex gap-2">
              {editing !== day.date && (
                <button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(day)}>Modifier</button>
              )}
              {day.is_override && (
                <button className="btn btn-sm btn-outline-danger" onClick={() => handleClear(day.date)}>
                  Revenir au naturel
                </button>
              )}
            </div>
          </div>

          {editing === day.date ? (
            <div className="mt-2">
              <textarea
                className="form-control mb-2"
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
              />
              <input
                className="form-control mb-2"
                placeholder="Référence (ex: Proverbes 3:5)"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditing('')}>Annuler</button>
              </div>
            </div>
          ) : (
            <p className="mb-0 mt-2 fst-italic">
              « {day.is_override ? day.override_text : day.natural_text} » — {day.is_override ? day.override_reference : day.natural_reference}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
