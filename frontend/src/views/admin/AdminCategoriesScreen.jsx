import { adminAPI } from '../../utils/api';
import AdminCrud from './ui/AdminCrud';

const api = {
  list: adminAPI.categories,
  create: adminAPI.createCategory,
  update: adminAPI.updateCategory,
  remove: adminAPI.deleteCategory,
};

const FIELDS = [
  { name: 'name', label: 'Nom de la catégorie', type: 'text', required: true, help: 'Ex : Chapelets, Médailles, Bracelets…' },
  { name: 'order', label: "Ordre d'affichage", type: 'number', help: 'Les plus petits numéros apparaissent en premier.' },
  { name: 'image', label: 'Photo (facultative)', type: 'image', help: "Si vide, la photo d'un des produits de la catégorie est utilisée sur l'accueil." },
];

const COLUMNS = [
  { label: 'Catégorie', render: (c) => <strong>{c.name}</strong> },
  { label: 'Ordre', render: (c) => <span className="cell-muted">{c.order}</span> },
];

export default function AdminCategoriesScreen() {
  return (
    <AdminCrud
      kicker="Catalogue" title="Catégories"
      lead="Les familles de bijoux affichées dans la boutique et sur la page d'accueil."
      newLabel="Nouvelle catégorie" emptyText="Aucune catégorie pour le moment."
      api={api} fields={FIELDS} columns={COLUMNS} itemName={(c) => c.name} defaults={{ order: 0 }}
      thumb={(c) => c.image}
      deleteWarning="Les produits de cette catégorie ne seront pas supprimés : ils resteront sans catégorie."
    />
  );
}
