import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaSearch, FaUser, FaShoppingBag, FaTimes } from 'react-icons/fa';
import useAuthStore from '../store/auth';
import useCartStore from '../store/cart';
import { productsAPI } from '../utils/api';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { fetchCart, itemCount } = useCartStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const suggestTimer = useRef(null);

  useEffect(() => {
    fetchCart();
  }, []);

  useEffect(() => {
    clearTimeout(suggestTimer.current);
    if (searchValue.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    suggestTimer.current = setTimeout(() => {
      productsAPI.suggest(searchValue.trim()).then(({ data }) => setSuggestions(data)).catch(() => {});
    }, 250);
    return () => clearTimeout(suggestTimer.current);
  }, [searchValue]);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchValue.trim()) return;
    navigate(`/catalogue?search=${encodeURIComponent(searchValue.trim())}`);
    closeSearch();
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchValue('');
    setSuggestions([]);
  };

  const goToSuggestion = (product) => {
    navigate(`/produits/${product.slug}`);
    closeSearch();
  };

  return (
    <header>
      <div className="topbar text-center py-2 text-uppercase">
        Livraison rapide en Côte d'Ivoire · Emballage cadeau offert · Paiement sécurisé
      </div>

      <nav className="navbar-main py-3">
        <div className="container d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-4">
            <button className="btn-icon d-md-none" onClick={() => setMenuOpen((v) => !v)} aria-label="Ouvrir le menu">
              {menuOpen ? <FaTimes /> : <FaBars />}
            </button>
            <ul className="nav d-none d-md-flex gap-4 mb-0 list-unstyled">
              <li><Link to="/" className="nav-link-plain">Accueil</Link></li>
              <li><Link to="/catalogue" className="nav-link-plain">Bijoux</Link></li>
              <li><Link to="/coffrets" className="nav-link-plain">Coffrets</Link></li>
              <li className="position-relative"
                  onMouseEnter={() => setDiscoverOpen(true)}
                  onMouseLeave={() => setDiscoverOpen(false)}
              >
                <button
                  type="button"
                  className="nav-link-plain btn btn-link p-0 border-0"
                  style={{ textDecoration: 'none' }}
                  onClick={() => setDiscoverOpen((v) => !v)}
                >
                  Découvrir
                </button>
                {discoverOpen && (
                  <div className="discover-dropdown">
                    <Link to="/guide-symboles" onClick={() => setDiscoverOpen(false)}>Guide des symboles</Link>
                    <Link to="/lookbook" onClick={() => setDiscoverOpen(false)}>Lookbook</Link>
                    <Link to="/quiz" onClick={() => setDiscoverOpen(false)}>Quel objet choisir ?</Link>
                    <Link to="/cadeau" onClick={() => setDiscoverOpen(false)}>Je cherche un cadeau</Link>
                    <Link to="/cartes-cadeaux" onClick={() => setDiscoverOpen(false)}>Cartes cadeaux</Link>
                  </div>
                )}
              </li>
              <li><Link to="/suivi" className="nav-link-plain">Suivre ma commande</Link></li>
            </ul>
          </div>

          <Link to="/" className="text-center text-decoration-none">
            <img
              src="/images/logo.jpeg"
              alt="Mon Armoire"
              className="navbar-logo"
            />
          </Link>

          <div className="d-flex align-items-center gap-0 gap-md-3">
            {user?.is_staff && (
              <Link to="/admin" className="nav-link-plain text-gold d-none d-md-inline">Back-office</Link>
            )}
            <button className="btn-icon" onClick={() => setSearchOpen((v) => !v)} aria-label="Rechercher">
              <FaSearch />
            </button>
            <Link to={isAuthenticated ? '/compte' : '/login'} className="btn-icon" aria-label="Mon compte">
              <FaUser />
            </Link>
            <Link to="/panier" className="btn-icon position-relative" aria-label="Mon panier">
              <FaShoppingBag />
              {itemCount() > 0 && <span className="cart-count">{itemCount()}</span>}
            </Link>
          </div>
        </div>

        {searchOpen && (
          <div className="container mt-3">
            <div className="position-relative" style={{ maxWidth: 420 }}>
              <form onSubmit={handleSearch} className="d-flex gap-2">
                <input
                  className="form-control"
                  placeholder="Rechercher un bijou..."
                  autoFocus
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
                <button className="btn btn-primary text-uppercase small tracking-wide" type="submit">OK</button>
              </form>
              {suggestions.length > 0 && (
                <div className="search-suggestions">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="search-suggestion-item"
                      onClick={() => goToSuggestion(p)}
                    >
                      {p.main_image ? (
                        <img src={p.main_image} alt="" />
                      ) : (
                        <span className="search-suggestion-noimg" />
                      )}
                      <span className="flex-grow-1 text-start">
                        <span className="d-block small">{p.name}</span>
                        {p.price && <span className="d-block small text-gold">{Number(p.price).toLocaleString('fr-FR')} FCFA</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {menuOpen && (
          <div className="container mobile-menu d-md-none">
            <Link to="/" onClick={() => setMenuOpen(false)}>Accueil</Link>
            <Link to="/catalogue" onClick={() => setMenuOpen(false)}>Bijoux</Link>
            <Link to="/coffrets" onClick={() => setMenuOpen(false)}>Coffrets</Link>
            <Link to="/guide-symboles" onClick={() => setMenuOpen(false)}>Guide des symboles</Link>
            <Link to="/lookbook" onClick={() => setMenuOpen(false)}>Lookbook</Link>
            <Link to="/quiz" onClick={() => setMenuOpen(false)}>Quel objet choisir ?</Link>
            <Link to="/cadeau" onClick={() => setMenuOpen(false)}>Je cherche un cadeau</Link>
            <Link to="/cartes-cadeaux" onClick={() => setMenuOpen(false)}>Cartes cadeaux</Link>
            <Link to="/suivi" onClick={() => setMenuOpen(false)}>Suivre ma commande</Link>
            {user?.is_staff && <Link to="/admin" onClick={() => setMenuOpen(false)}>Back-office</Link>}

            <div className="mt-3">
              {isAuthenticated ? (
                <button className="btn btn-outline-primary btn-sm text-uppercase small tracking-wide" onClick={handleLogout}>
                  Déconnexion
                </button>
              ) : (
                <div className="d-flex gap-2">
                  <Link to="/login" className="btn btn-outline-primary btn-sm text-uppercase small tracking-wide" onClick={() => setMenuOpen(false)}>
                    Connexion
                  </Link>
                  <Link to="/register" className="btn btn-primary btn-sm text-uppercase small tracking-wide" onClick={() => setMenuOpen(false)}>
                    Créer un compte
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
