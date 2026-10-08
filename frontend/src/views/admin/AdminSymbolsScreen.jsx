import { useCallback } from 'react';
import { adminAPI } from '../../utils/api';
import AdminCrud from './ui/AdminCrud';
import { StatusBadge } from './ui/parts';

const api = {
  list: adminAPI.symbols,
  create: adminAPI.createSymbol,
  update: adminAPI.updateSymbol,
  remove: adminAPI.deleteSymbol,
};

const FIELDS = [
  { name: 'name', label: 'Symbole', type: 'text', required: true, help: 'Ex : La Croix, Le Chapelet, La Médaille miraculeuse' },
  { name: 'subtitle', label: 'Courte accroche', type: 'text', help: 'Affichée sur la carte du guide.' },
  { name: 'category', label: 'Catégorie de bijoux associée', type: 'select', optionsKey: 'categories', emptyLabel: '— Aucune —', help: 'Sert au bouton « Découvrir » du guide.' },
  { name: 'order', label: "Ordre d'affichage", type: 'number' },
  { name: 'meaning', label: 'Signification', type: 'textarea', required: true, rows: 6, help: 'Le texte explicatif détaillé.' },
  { name: 'image', label: 'Illustration (facultative)', type: 'image' },
  { name: 'is_active', label: 'Visible dans le guide', type: 'checkbox' },
];

const COLUMNS = [
  { label: 'Symbole', render: (s) => <strong>{s.name}</strong> },
  { label: 'Accroche', render: (s) => <span className="cell-muted">{s.subtitle || '—'}</span> },
  { label: 'État', render: (s) => <StatusBadge status={s.is_active ? 'on' : 'off'} label={s.is_active ? 'Visible' : 'Masqué'} /> },
];

export default function AdminSymbolsScreen() {
  const loadOptions = useCallback(async () => {
    const { data } = await adminAPI.categories();
    return { categories: data.map((c) => ({ value: c.id, label: c.name })) };
  }, []);

  return (
    <AdminCrud
      kicker="Catalogue" title="Guide des symboles"
      lead="Les fiches pédagogiques (croix, chapelet, médaille…) qui aident les clientes à choisir un bijou chargé de sens."
      newLabel="Nouveau symbole" emptyText="Aucun symbole pour le moment."
      api={api} fields={FIELDS} columns={COLUMNS} itemName={(s) => s.name} defaults={{ order: 0 }}
      thumb={(s) => s.image} loadOptions={loadOptions}
    />
  );
}
