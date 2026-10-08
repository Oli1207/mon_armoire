import { adminAPI } from '../../utils/api';
import AdminCrud from './ui/AdminCrud';
import { StatusBadge, fcfa } from './ui/parts';

const api = {
  list: adminAPI.zones,
  create: adminAPI.createZone,
  update: adminAPI.updateZone,
  remove: adminAPI.deleteZone,
};

const FIELDS = [
  { name: 'name', label: 'Nom de la zone', type: 'text', required: true, help: 'Ex : Abidjan (Cocody, Plateau…)' },
  { name: 'shipping_cost', label: 'Tarif de livraison (FCFA)', type: 'number', required: true, step: 100 },
  { name: 'estimated_days_min', label: 'Délai minimum (jours)', type: 'number', required: true },
  { name: 'estimated_days_max', label: 'Délai maximum (jours)', type: 'number', required: true },
  { name: 'is_active', label: 'Proposée aux clientes au moment de commander', type: 'checkbox' },
];

const COLUMNS = [
  { label: 'Zone', render: (z) => <strong>{z.name}</strong> },
  { label: 'Tarif', render: (z) => fcfa(z.shipping_cost) },
  {
    label: 'Délai',
    render: (z) => (z.estimated_days_min === z.estimated_days_max
      ? `${z.estimated_days_min} jour(s)`
      : `${z.estimated_days_min} à ${z.estimated_days_max} jours`),
  },
  { label: 'État', render: (z) => <StatusBadge status={z.is_active ? 'on' : 'off'} label={z.is_active ? 'Proposée' : 'Masquée'} /> },
];

export default function AdminZonesScreen() {
  return (
    <AdminCrud
      kicker="Réglages" title="Livraison"
      lead="Les zones et tarifs proposés aux clientes au moment de commander. Une zone masquée n'apparaît plus, mais les anciennes commandes gardent leur tarif."
      newLabel="Nouvelle zone" emptyText="Aucune zone de livraison : les clientes ne pourront pas commander avec livraison."
      api={api} fields={FIELDS} columns={COLUMNS} itemName={(z) => z.name}
      deleteWarning="Les commandes déjà passées gardent leur tarif de livraison. Pour simplement arrêter de proposer cette zone, il suffit de la masquer."
    />
  );
}
