import axios from 'axios';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { API_BASE_URL } from './constants';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

// ── Vérifie si un token JWT est expiré ────────────────────────────────────────
function isTokenExpired(token) {
  try {
    const decoded = jwtDecode(token);
    return decoded.exp * 1000 < Date.now() + 5000; // marge 5 s
  } catch {
    return true;
  }
}

// ── Refresh singleton (évite les rafales parallèles) ─────────────────────────
let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = Cookies.get('refresh_token');
    if (!refresh) throw new Error('No refresh token');
    const { data } = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, { refresh });
    const isSecure = window.location.protocol === 'https:';
    Cookies.set('access_token', data.access, { secure: isSecure, sameSite: 'Strict', expires: 1 });
    if (data.refresh) {
      Cookies.set('refresh_token', data.refresh, { secure: isSecure, sameSite: 'Strict', expires: 30 });
    }
    return data.access;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// ── Intercepteur requête — renouvelle avant envoi si nécessaire ───────────────
axiosInstance.interceptors.request.use(async (config) => {
  let access = Cookies.get('access_token');

  if (access && isTokenExpired(access)) {
    try {
      access = await refreshAccessToken();
    } catch (e) {
      if (e?.response?.status === 401) {
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
      }
      return config;
    }
  }

  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

// ── Intercepteur réponse — retry sur 401 ─────────────────────────────────────
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const access = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${access}`;
        return axiosInstance(original);
      } catch (e) {
        if (e?.response?.status === 401) {
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
        }
      }
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
