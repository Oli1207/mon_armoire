import { Suspense, useEffect, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import '@fontsource/neucha/latin-400.css';
import '@fontsource/cabin-sketch/latin-400.css';
import '@fontsource/cabin-sketch/latin-700.css';
import 'bootswatch/dist/sketchy/bootstrap.min.css';
import './index.css';
import './mobile.css';

import useAuthStore from './store/auth';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import InstallPrompt from './components/InstallPrompt';
import PrivateRoute from './layout/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';
import BackBar from './components/BackBar';
import { AdminHome, Need } from './layout/AdminGuards';
import { setStaff, track } from './utils/tracker';
import useSiteStore from './store/site';
import PageSkeleton from './components/PageSkeleton';
import lazyWithRetry from './utils/lazyWithRetry';

import HomeScreen from './views/screens/HomeScreen';
const CatalogueScreen = lazyWithRetry(() => import('./views/screens/CatalogueScreen'));
const ProductDetailScreen = lazyWithRetry(() => import('./views/screens/ProductDetailScreen'));
const AccountScreen = lazyWithRetry(() => import('./views/screens/AccountScreen'));
const CartScreen = lazyWithRetry(() => import('./views/screens/CartScreen'));
const CoffretsListScreen = lazyWithRetry(() => import('./views/screens/CoffretsListScreen'));
const CoffretConfiguratorScreen = lazyWithRetry(() => import('./views/screens/CoffretConfiguratorScreen'));
const CheckoutScreen = lazyWithRetry(() => import('./views/screens/CheckoutScreen'));
const OrderConfirmedScreen = lazyWithRetry(() => import('./views/screens/OrderConfirmedScreen'));
const TrackOrderScreen = lazyWithRetry(() => import('./views/screens/TrackOrderScreen'));
const PaymentReturnScreen = lazyWithRetry(() => import('./views/screens/PaymentReturnScreen'));
const SymbolGuideScreen = lazyWithRetry(() => import('./views/screens/SymbolGuideScreen'));
const LookbookScreen = lazyWithRetry(() => import('./views/screens/LookbookScreen'));
const QuizScreen = lazyWithRetry(() => import('./views/screens/QuizScreen'));
const GiftFinderScreen = lazyWithRetry(() => import('./views/screens/GiftFinderScreen'));
const GiftCardsScreen = lazyWithRetry(() => import('./views/screens/GiftCardsScreen'));

const LoginScreen = lazyWithRetry(() => import('./views/auth/LoginScreen'));
const RegisterScreen = lazyWithRetry(() => import('./views/auth/RegisterScreen'));
const ForgotPasswordScreen = lazyWithRetry(() => import('./views/auth/ForgotPasswordScreen'));
const ResetPasswordScreen = lazyWithRetry(() => import('./views/auth/ResetPasswordScreen'));

import AdminRoute from './layout/AdminRoute';
const AdminLayout = lazyWithRetry(() => import('./layout/AdminLayout'));
const AdminDashboardScreen = lazyWithRetry(() => import('./views/admin/AdminDashboardScreen'));
const AdminOrdersScreen = lazyWithRetry(() => import('./views/admin/AdminOrdersScreen'));
const AdminCustomersScreen = lazyWithRetry(() => import('./views/admin/AdminCustomersScreen'));
const AdminCustomerDetailScreen = lazyWithRetry(() => import('./views/admin/AdminCustomerDetailScreen'));
const AdminVersesScreen = lazyWithRetry(() => import('./views/admin/AdminVersesScreen'));
const AdminProductsScreen = lazyWithRetry(() => import('./views/admin/AdminProductsScreen'));
const AdminProductDetailScreen = lazyWithRetry(() => import('./views/admin/AdminProductDetailScreen'));
const AdminCoffretsScreen = lazyWithRetry(() => import('./views/admin/AdminCoffretsScreen'));
const AdminCoffretDetailScreen = lazyWithRetry(() => import('./views/admin/AdminCoffretDetailScreen'));
const AdminReviewsScreen = lazyWithRetry(() => import('./views/admin/AdminReviewsScreen'));
const AdminGiftCardsScreen = lazyWithRetry(() => import('./views/admin/AdminGiftCardsScreen'));
const AdminWaitlistScreen = lazyWithRetry(() => import('./views/admin/AdminWaitlistScreen'));
const AdminZonesScreen = lazyWithRetry(() => import('./views/admin/AdminZonesScreen'));
const AdminCategoriesScreen = lazyWithRetry(() => import('./views/admin/AdminCategoriesScreen'));
const AdminOccasionsScreen = lazyWithRetry(() => import('./views/admin/AdminOccasionsScreen'));
const AdminSymbolsScreen = lazyWithRetry(() => import('./views/admin/AdminSymbolsScreen'));
const AdminLookbookScreen = lazyWithRetry(() => import('./views/admin/AdminLookbookScreen'));
const AdminVisitorsScreen = lazyWithRetry(() => import('./views/admin/AdminVisitorsScreen'));
const AdminSiteScreen = lazyWithRetry(() => import('./views/admin/AdminSiteScreen'));
const InstallScreen = lazyWithRetry(() => import('./views/screens/InstallScreen'));
const LegalScreen = lazyWithRetry(() => import('./views/screens/LegalScreen'));
const AdminHelpScreen = lazyWithRetry(() => import('./views/admin/AdminHelpScreen'));
const AdminTeamScreen = lazyWithRetry(() => import('./views/admin/AdminTeamScreen'));
const AdminJournalScreen = lazyWithRetry(() => import('./views/admin/AdminJournalScreen'));

const PRELOAD = [
  () => import('./views/screens/CatalogueScreen'),
  () => import('./views/screens/ProductDetailScreen'),
  () => import('./views/screens/CartScreen'),
  () => import('./views/screens/CoffretsListScreen'),
  () => import('./views/screens/CoffretConfiguratorScreen'),
  () => import('./views/screens/CheckoutScreen'),
];

// Nouvelle page = on repart en haut (sinon on arrive en bas si on était en bas de la précédente).
// Retour/avance du navigateur : on laisse le navigateur rétablir la position. Changer seulement un filtre
// (?page=, ?category=) ne fait pas remonter la page.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType === 'POP') return;
    let target = null;
    try { target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null; } catch { /* ancre mal formée */ }
    if (target) target.scrollIntoView({ behavior: 'instant' });
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash, navigationType]);
  return null;
}

// Compte une page vue à chaque changement d'adresse ; le personnel de la boutique n'est jamais compté.
function PageTracking() {
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  useEffect(() => { track('pageview'); }, [pathname]);
  useEffect(() => { if (user?.is_staff) setStaff(true); }, [user?.is_staff]);
  return null;
}

// Une erreur sur une page ne doit pas bloquer les autres : le garde se réinitialise à chaque changement d'adresse.
function SafeRoutes({ children }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function App() {
  const { init, fetchMe } = useAuthStore();
  const { fetchSite } = useSiteStore();

  useEffect(() => {
    init();
    fetchMe();
    fetchSite();
  }, []);

  // Une fois l'accueil affiché, on télécharge en arrière-plan les pages les plus visitées : le clic suivant est instantané.
  // Rien si la personne a activé l'économiseur de données ou si la connexion est très lente.
  useEffect(() => {
    const connection = navigator.connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return undefined;
    const warm = () => PRELOAD.forEach((load) => load().catch(() => {}));
    const id = typeof requestIdleCallback === 'function' ? requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 2500);
    return () => (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <PageTracking />
      <Navbar />
      <BackBar />
      <SafeRoutes>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/catalogue" element={<CatalogueScreen />} />
        <Route path="/produits/:slug" element={<ProductDetailScreen />} />
        <Route path="/panier" element={<CartScreen />} />
        <Route path="/coffrets" element={<CoffretsListScreen />} />
        <Route path="/coffrets/:slug" element={<CoffretConfiguratorScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPasswordScreen />} />
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/checkout" element={<CheckoutScreen />} />
        <Route path="/commandes/:orderNumber" element={<OrderConfirmedScreen />} />
        <Route path="/suivi" element={<TrackOrderScreen />} />
        <Route path="/paiement/retour" element={<PaymentReturnScreen />} />
        <Route path="/guide-symboles" element={<SymbolGuideScreen />} />
        <Route path="/lookbook" element={<LookbookScreen />} />
        <Route path="/quiz" element={<QuizScreen />} />
        <Route path="/cadeau" element={<GiftFinderScreen />} />
        <Route path="/cartes-cadeaux" element={<GiftCardsScreen />} />
        <Route path="/installer" element={<InstallScreen />} />
        <Route path="/conditions-generales" element={<LegalScreen page="terms" />} />
        <Route path="/confidentialite" element={<LegalScreen page="privacy" />} />
        <Route element={<PrivateRoute />}>
          <Route path="/compte" element={<AccountScreen />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminHome overview={<AdminDashboardScreen />} />} />
            <Route path="/admin/commandes" element={<Need perms={['orders']}><AdminOrdersScreen /></Need>} />
            <Route path="/admin/clients" element={<Need perms={['customers']}><AdminCustomersScreen /></Need>} />
            <Route path="/admin/clients/:id" element={<Need perms={['customers']}><AdminCustomerDetailScreen /></Need>} />
            <Route path="/admin/versets" element={<Need perms={['settings']}><AdminVersesScreen /></Need>} />
            <Route path="/admin/produits" element={<Need perms={['catalog']}><AdminProductsScreen /></Need>} />
            <Route path="/admin/produits/:id" element={<Need perms={['catalog']}><AdminProductDetailScreen /></Need>} />
            <Route path="/admin/coffrets" element={<Need perms={['catalog']}><AdminCoffretsScreen /></Need>} />
            <Route path="/admin/coffrets/:id" element={<Need perms={['catalog']}><AdminCoffretDetailScreen /></Need>} />
            <Route path="/admin/avis" element={<Need perms={['reviews']}><AdminReviewsScreen /></Need>} />
            <Route path="/admin/cartes-cadeaux" element={<Need perms={['giftcards']}><AdminGiftCardsScreen /></Need>} />
            <Route path="/admin/liste-attente" element={<Need perms={['waitlist']}><AdminWaitlistScreen /></Need>} />
            <Route path="/admin/livraison" element={<Need perms={['settings']}><AdminZonesScreen /></Need>} />
            <Route path="/admin/categories" element={<Need perms={['catalog']}><AdminCategoriesScreen /></Need>} />
            <Route path="/admin/occasions" element={<Need perms={['catalog']}><AdminOccasionsScreen /></Need>} />
            <Route path="/admin/symboles" element={<Need perms={['catalog']}><AdminSymbolsScreen /></Need>} />
            <Route path="/admin/lookbook" element={<Need perms={['catalog']}><AdminLookbookScreen /></Need>} />
            <Route path="/admin/visiteurs" element={<Need perms={['analytics']}><AdminVisitorsScreen /></Need>} />
            <Route path="/admin/site" element={<Need perms={['settings']}><AdminSiteScreen /></Need>} />
            <Route path="/admin/aide" element={<AdminHelpScreen />} />
            <Route path="/admin/equipe" element={<Need perms={['team']}><AdminTeamScreen /></Need>} />
            <Route path="/admin/journal" element={<Need perms={['journal']}><AdminJournalScreen /></Need>} />
          </Route>
        </Route>
      </Routes>
      </SafeRoutes>
      <Footer />
      <InstallPrompt />
    </BrowserRouter>
  );
}

export default App;
