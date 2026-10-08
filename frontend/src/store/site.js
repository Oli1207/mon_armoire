import { create } from 'zustand';
import axiosInstance from '../utils/axios';

// Valeurs d'origine : le site s'affiche correctement tout de suite, avant même la réponse du serveur.
const DEFAULTS = {
  announcement: "Livraison rapide en Côte d'Ivoire · Emballage cadeau offert · Paiement sécurisé",
  hero_kicker: 'Bijoux & objets chrétiens',
  hero_title: 'Porte ta foi avec élégance',
  hero_text: 'Des bijoux et objets chrétiens pensés pour accompagner votre foi au quotidien.',
  hero_image: null,
  footer_text: 'Des bijoux et objets de piété pensés pour accompagner votre foi, au quotidien comme dans les grands moments.',
  tagline: 'Chaque vision mérite de voir le jour',
  contact_email: 'support@monarmoire.store',
  phone: '',
  whatsapp: '',
  instagram: '',
  tiktok: '',
  facebook: '',
  youtube: '',
  location: "Abidjan, Côte d'Ivoire",
  has_terms: false,
  has_privacy: false,
};

const useSiteStore = create((set, get) => ({
  site: DEFAULTS,
  loaded: false,
  fetchSite: async () => {
    if (get().loaded) return;
    set({ loaded: true });
    try {
      const { data } = await axiosInstance.get('/api/site/');
      set({ site: { ...DEFAULTS, ...data } });
    } catch {
      /* les valeurs d'origine restent affichées */
    }
  },
}));

export default useSiteStore;
