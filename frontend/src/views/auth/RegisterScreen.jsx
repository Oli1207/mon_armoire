import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../../store/auth';

export default function RegisterScreen() {
  const { register, loading } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = (searchParams.get('ref') || '').toUpperCase();
  const [form, setForm] = useState({ email: '', full_name: '', phone: '', password: '', password2: '', referral_code: referralCode });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    const res = await register(form);
    if (res.success) {
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } else {
      setErrors(res.error);
    }
  };

  if (done) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 440 }}>
        <div className="alert alert-success">Compte créé avec succès. Redirection vers la connexion...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Rejoignez-nous</p>
        <h1 className="h1 mb-0">Créer un compte</h1>
      </div>

      <div className="container py-5" style={{ maxWidth: 440 }}>
        {referralCode && (
          <div className="verse-banner p-3 mb-3 text-center">
            <p className="mb-0 small">
              Vous avez été invité(e) avec le code <strong>{referralCode}</strong> — vous recevrez 10 points de fidélité de bienvenue !
            </p>
          </div>
        )}
        <div className="card p-4 shadow-sm">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label small text-uppercase tracking-wide">Nom complet</label>
              <input autoComplete="name" name="full_name" className="form-control" value={form.full_name} onChange={handleChange} />
            </div>
            <div className="mb-3">
              <label className="form-label small text-uppercase tracking-wide">Email</label>
              <input autoComplete="email" inputMode="email" type="email" name="email" className="form-control" value={form.email} onChange={handleChange} required />
              {errors.email && <div className="text-danger small">{errors.email}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label small text-uppercase tracking-wide">Téléphone</label>
              <input type="tel" autoComplete="tel" inputMode="tel" name="phone" className="form-control" value={form.phone} onChange={handleChange} />
            </div>
            <div className="mb-3">
              <label className="form-label small text-uppercase tracking-wide">Mot de passe</label>
              <input autoComplete="new-password" type="password" name="password" className="form-control" value={form.password} onChange={handleChange} required />
              {errors.password && <div className="text-danger small">{errors.password}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label small text-uppercase tracking-wide">Confirmer le mot de passe</label>
              <input autoComplete="new-password" type="password" name="password2" className="form-control" value={form.password2} onChange={handleChange} required />
            </div>
            <button type="submit" className="btn btn-primary w-100 py-2 text-uppercase small tracking-wide" disabled={loading}>
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>
        </div>
        <p className="text-center mt-3">
          Déjà un compte ? <Link to="/login" className="text-gold">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
