import { useCallback } from 'react';
import { adminAPI } from '../../utils/api';
import AdminCrud from './ui/AdminCrud';
import { StatusBadge } from './ui/parts';

const api = {
  list: adminAPI.lookbook,
  create: adminAPI.createLookbookEntry,
  update: adminAPI.updateLookbookEntry,
  remove: adminAPI.deleteLookbookEntry,
};

const FIELDS = [
  { name: 'title', label: 'Titre', type: 'text', required: true, help: 'Ex : Look du dimanche' },
  { name: 'order', label: "Ordre d'affichage", type: 'number' },
  { name: 'description', label: 'Description (facultative)', type: 'textarea', rows: 3 },
  { name: 'image', label: 'Photo', type: 'image', help: 'Photo de la tenue ou de la mise en scène (obligatoire pour une nouvelle entrée).' },
  { name: 'products', label: 'Bijoux visibles sur la photo', type: 'multi', optionsKey: 'products', help: 'Les clientes pourront les ajouter au panier depuis la photo.' },
  { name: 'is_active', label: 'Visible dans le lookbook', type: 'checkbox' },
];

const COLUMNS = [
  { label: 'Titre', render: (e) => <strong>{e.title}</strong> },
  { label: 'Bijoux liés', render: (e) => <span className="cell-muted">{e.products.length}</span> },
  { label: 'État', render: (e) => <StatusBadge status={e.is_active ? 'on' : 'off'} label={e.is_active ? 'Visible' : 'Masqué'} /> },
];

export default function AdminLookbookScreen() {
  const loadOptions = useCallback(async () => {
    const { data } = await adminAPI.productOptions();
    return { products: data.map((p) => ({ value: p.id, label: p.name })) };
  }, []);

  return (
    <AdminCrud
      kicker="Catalogue" title="Lookbook"
      lead="La galerie d'inspiration : des photos où l'on peut « shopper le look »."
      newLabel="Nouvelle photo" emptyText="Aucune photo dans le lookbook."
      api={api} fields={FIELDS} columns={COLUMNS} itemName={(e) => e.title} defaults={{ order: 0 }}
      thumb={(e) => e.image} loadOptions={loadOptions}
    />
  );
}
