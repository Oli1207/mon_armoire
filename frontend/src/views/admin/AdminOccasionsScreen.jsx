import { adminAPI } from '../../utils/api';
import AdminCrud from './ui/AdminCrud';

const api = {
  list: adminAPI.collections,
  create: adminAPI.createCollection,
  update: adminAPI.updateCollection,
  remove: adminAPI.deleteCollection,
};

const KINDS = [
  { value: 'occasion', label: 'Occasion (baptême, mariage, fête…)' },
  { value: 'style', label: 'Style' },
];

const FIELDS = [
  { name: 'name', label: 'Nom', type: 'text', required: true, help: 'Ex : Baptême, Mariage, Fête des mères…' },
  { name: 'kind', label: 'Type', type: 'select', required: true, options: KINDS, emptyLabel: 'Choisir…' },
  { name: 'description', label: 'Description (facultative)', type: 'textarea', rows: 3 },
  { name: 'order', label: "Ordre d'affichage", type: 'number' },
  { name: 'image', label: 'Photo (facultative)', type: 'image' },
];

const COLUMNS = [
  { label: 'Nom', render: (c) => <strong>{c.name}</strong> },
  { label: 'Type', render: (c) => <span className="cell-muted">{c.kind === 'occasion' ? 'Occasion' : 'Style'}</span> },
  { label: 'Description', render: (c) => <span className="cell-muted">{c.description || '—'}</span> },
];

export default function AdminOccasionsScreen() {
  return (
    <AdminCrud
      kicker="Catalogue" title="Occasions"
      lead="Les occasions proposées dans « Je cherche un cadeau » : la cliente choisit une occasion et un budget. Rattachez ensuite les produits à une occasion depuis leur fiche."
      newLabel="Nouvelle occasion" emptyText="Aucune occasion pour le moment."
      api={api} fields={FIELDS} columns={COLUMNS} itemName={(c) => c.name} defaults={{ kind: 'occasion', order: 0 }}
      thumb={(c) => c.image}
      deleteWarning="Les produits ne sont pas supprimés : ils ne seront simplement plus rattachés à cette occasion."
    />
  );
}
