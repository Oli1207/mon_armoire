import { create } from 'zustand';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { authAPI } from '../utils/api';
import { errorText } from '../utils/errors';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: false,
  authReady: false, // true dès que fetchMe() a terminé (succès ou échec)

  // ── Initialisation depuis les cookies ──────────────────────────────────────
  init: () => {
    const token = Cookies.get('access_token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        set({ user: decoded, isAuthenticated: true });
      } catch {
        set({ user: null, isAuthenticated: false, authReady: true });
      }
    } else {
      set({ authReady: true });
    }
  },

  // ── Connexion ─────────────────────────────────────────────────────────────
  login: async (email, password) => {
    set({ loading: true });
    try {
      const { data } = await authAPI.login({ email, password });
      const isSecure = window.location.protocol === 'https:';
      Cookies.set('access_token', data.access, { secure: isSecure, sameSite: 'Strict', expires: 1 });
      Cookies.set('refresh_token', data.refresh, { secure: isSecure, sameSite: 'Strict', expires: 30 });
      const decoded = jwtDecode(data.access);
      set({ user: decoded, isAuthenticated: true, loading: false, authReady: true });
      return { success: true };
    } catch (err) {
      set({ loading: false });
      const status = err.response?.status;
      const msg = status === 400 || status === 401 ? 'Email ou mot de passe incorrect.' : errorText(err);
      return { success: false, error: msg };
    }
  },

  // ── Inscription ───────────────────────────────────────────────────────────
  register: async (payload) => {
    set({ loading: true });
    try {
      await authAPI.register(payload);
      set({ loading: false });
      return { success: true };
    } catch (err) {
      set({ loading: false });
      const data = err.response?.data;
      return { success: false, error: err.response?.status === 400 && data && typeof data === 'object' ? data : { detail: errorText(err, 'Le compte n’a pas pu être créé. Réessayez.') } };
    }
  },

  // ── Déconnexion ───────────────────────────────────────────────────────────
  logout: () => {
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  // ── Fetch profil complet ──────────────────────────────────────────────────
  fetchMe: async () => {
    try {
      const { data } = await authAPI.me();
      set({ user: data, isAuthenticated: true, authReady: true });
    } catch {
      get().logout();
      set({ authReady: true });
    }
  },
}));

export default useAuthStore;
