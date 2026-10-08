import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Les polices du thème Sketchy sont hébergées avec le site (@fontsource) : on retire l'@import Google Fonts du thème,
// qui ajoutait deux connexions externes et une chaîne de requêtes avant l'affichage du texte.
const selfHostedFonts = () => ({
  name: 'self-hosted-fonts',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('bootswatch') || !id.endsWith('.css')) return null;
    return code.replace(/@import url\(https:\/\/fonts\.googleapis\.com[^)]*\);?/g, '');
  },
});

// Ouvre la connexion vers l'API dès le chargement de la page (elle est sur un autre sous-domaine) au lieu d'attendre le premier appel.
const preconnectApi = (apiUrl) => ({
  name: 'preconnect-api',
  transformIndexHtml() {
    if (!apiUrl) return [];
    return [{ tag: 'link', attrs: { rel: 'preconnect', href: new URL(apiUrl).origin, crossorigin: '' }, injectTo: 'head-prepend' }];
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [selfHostedFonts(), react(), preconnectApi(env.VITE_API_URL)],
    server: {
      host: true,
      proxy: {
        '/api':   { target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000', changeOrigin: true },
        '/media': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000', changeOrigin: true },
      },
    },
  };
});
