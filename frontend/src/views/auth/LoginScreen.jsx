import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/auth';

export default function LoginScreen() {
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await login(email, password);
    if (res.success) {
      navigate('/');
    } else {
      setError(res.error);
    }
  };

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Bienvenue</p>
        <h1 className="h1 mb-0">Connexion</h1>
      </div>

      <div className="container py-5" style={{ maxWidth: 440 }}>
        <div className="card p-4 shadow-sm">
          {error && <div className="alert alert-danger">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small text-uppercase tracking-wide">Email</label>
              <input autoComplete="email" inputMode="email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="form-label small text-uppercase tracking-wide">Mot de passe</label>
              <input autoComplete="current-password" type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary w-100 py-2 text-uppercase small tracking-wide" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
          <p className="text-center small mt-3 mb-0">
            <Link to="/mot-de-passe-oublie" className="link-tap text-muted">Mot de passe oublié ?</Link>
          </p>
        </div>
        <p className="text-center mt-3">
          Pas encore de compte ? <Link to="/register" className="text-gold">Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}
