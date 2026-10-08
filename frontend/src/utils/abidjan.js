// Communes d'Abidjan (liste identique à celle du serveur : backend/common/places.py) et quartiers courants proposés en suggestion.
// Les suggestions aident la saisie ; la cliente peut toujours écrire un autre quartier.
export const COMMUNES = [
  'Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Cocody', 'Koumassi',
  'Marcory', 'Plateau', 'Port-Bouët', 'Songon', 'Treichville', 'Yopougon',
];

export const QUARTIERS = {
  Abobo: ['Abobo Baoulé', 'PK 18', 'Avocatier', 'Anador', 'Sagbé', 'Belleville', 'Clouetcha', 'Kennedy'],
  Adjamé: ['Williamsville', 'Liberté', 'Paillet', '220 Logements', 'Bracodi'],
  Attécoubé: ['Locodjro', 'Agban', 'Boribana'],
  Cocody: ['Riviera', 'Riviera Palmeraie', 'Angré', 'Deux-Plateaux', 'Danga', 'Blockhauss', 'Saint-Jean', 'Mermoz', 'Faya', 'Attoban'],
  Koumassi: ['Grand Campement', 'Soweto', 'Prodomo'],
  Marcory: ['Zone 4', 'Biétry', 'Anoumabo', 'Résidentiel', 'Sans Fil'],
  'Port-Bouët': ['Vridi', 'Gonzagueville', 'Adjouffou', 'Jean-Folly'],
  Treichville: ['Arras', 'Biafra', 'Zone 3'],
  Yopougon: ['Niangon', 'Sicogi', 'Selmer', 'Maroc', 'Millionnaire', 'Toits Rouges', 'Gesco', 'Andokoi', 'Wassakara'],
};

const plain = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
export const isAbidjan = (city) => plain(city || '').startsWith('abidjan');
