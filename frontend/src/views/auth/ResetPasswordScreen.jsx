import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../../utils/api';

export default function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== password2) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword({ token, new_password: password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Ce lien est invalide ou a expiré.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Dernière étape</p>
        <h1 className="h1 mb-0">Nouveau mot de passe</h1>
      </div>

      <div className="container py-5" style={{ maxWidth: 440 }}>
        <div className="card p-4 shadow-sm">
          {!token ? (
            <p className="text-danger mb-0">
              Ce lien est invalide. Faites une nouvelle demande depuis la page{' '}
              <Link to="/mot-de-passe-oublie" className="text-gold">mot de passe oublié</Link>.
            </p>
          ) : done ? (
            <p className="text-success mb-0">Mot de passe modifié. Redirection vers la connexion...</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label small text-uppercase tracking-wide">Nouveau mot de passe</label>
                <input autoComplete="new-password" type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label small text-uppercase tracking-wide">Confirmer le mot de passe</label>
                <input autoComplete="new-password" type="password" className="form-control" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
              </div>
              {error && <div className="alert alert-danger">{error}</div>}
              <button type="submit" className="btn btn-primary w-100 py-2 text-uppercase small tracking-wide" disabled={loading}>
                {loading ? 'Enregistrement...' : 'Valider mon nouveau mot de passe'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
