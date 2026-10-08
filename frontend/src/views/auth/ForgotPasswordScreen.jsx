import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../../utils/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Pas de panique</p>
        <h1 className="h1 mb-0">Mot de passe oublié</h1>
      </div>

      <div className="container py-5" style={{ maxWidth: 440 }}>
        <div className="card p-4 shadow-sm">
          {done ? (
            <div className="text-center">
              <p className="mb-0">
                Si un compte existe avec cet email, un lien pour créer un nouveau mot de passe vient de vous être envoyé.
                Vérifiez votre boîte mail (et vos spams).
              </p>
            </div>
          ) : (
            <>
              <p className="text-muted small mb-3">
                Indiquez l'email de votre compte, nous vous enverrons un lien pour créer un nouveau mot de passe.
              </p>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label small text-uppercase tracking-wide">Email</label>
                  <input autoComplete="email" inputMode="email" type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary w-100 py-2 text-uppercase small tracking-wide" disabled={loading}>
                  {loading ? 'Envoi...' : 'Recevoir le lien'}
                </button>
              </form>
            </>
          )}
        </div>
        <p className="text-center mt-3">
          <Link to="/login" className="text-gold">← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
