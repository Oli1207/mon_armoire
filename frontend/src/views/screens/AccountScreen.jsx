import QueuedImage from '../../components/QueuedImage';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/auth';
import { favoritesAPI, ordersAPI, loyaltyAPI, authAPI } from '../../utils/api';
import { useLoadMore } from '../../utils/usePaginated';
import ListStatus from '../../components/ListStatus';

const STATUS_LABELS = {
  pending: 'En attente', paid: 'Payée', processing: 'En préparation',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

export default function AccountScreen() {
  const { user, fetchMe } = useAuthStore();
  // Les commandes se chargent d'abord ; les favoris (plus bas dans la page) ensuite, pas en même temps.
  const orders = useLoadMore(ordersAPI.mine);
  const favorites = useLoadMore(favoritesAPI.list, {}, !orders.loading);
  const [loyalty, setLoyalty] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' });
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', new_password2: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    loyaltyAPI.balance().then(({ data }) => setLoyalty(data));
  }, []);

  useEffect(() => {
    if (user) setProfileForm({ full_name: user.full_name || '', phone: user.phone || '' });
  }, [user]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      await authAPI.updateProfile(profileForm);
      await fetchMe();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);
    if (passwordForm.new_password !== passwordForm.new_password2) {
      setPasswordError('Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    setSavingPassword(true);
    try {
      await authAPI.changePassword(passwordForm);
      setPasswordForm({ old_password: '', new_password: '', new_password2: '' });
      setPasswordSaved(true);
      setTimeout(() => { setPasswordSaved(false); setShowPasswordForm(false); }, 2000);
    } catch (err) {
      setPasswordError(err.response?.data?.old_password?.[0] || err.response?.data?.detail || 'Erreur lors du changement de mot de passe.');
    } finally {
      setSavingPassword(false);
    }
  };

  const referralLink = user?.referral_code ? `${window.location.origin}/register?ref=${user.referral_code}` : '';

  const copyReferralLink = () => {
    navigator.clipboard?.writeText(referralLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Mon espace</p>
        <h1 className="h1 mb-0">{user?.full_name || 'Mon compte'}</h1>
        <p className="text-muted mt-2 mb-0">{user?.email}</p>
      </div>

      <div className="container py-5">
        <div className="card p-4 mb-5 shadow-sm">
          <h2 className="h5 mb-3">Mon profil</h2>
          <form onSubmit={handleSaveProfile} className="row g-2 align-items-end">
            <div className="col-sm-5">
              <label className="form-label small text-uppercase tracking-wide">Nom complet</label>
              <input autoComplete="name"
                className="form-control"
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
              />
            </div>
            <div className="col-sm-4">
              <label className="form-label small text-uppercase tracking-wide">Téléphone</label>
              <input type="tel" autoComplete="tel" inputMode="tel"
                className="form-control"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              />
            </div>
            <div className="col-sm-3">
              <button className="btn btn-primary w-100 text-uppercase small tracking-wide" disabled={savingProfile}>
                {savingProfile ? 'Enregistrement...' : profileSaved ? 'Enregistré !' : 'Enregistrer'}
              </button>
            </div>
          </form>

          <hr className="my-4" />

          {!showPasswordForm ? (
            <button className="btn btn-outline-primary btn-sm text-uppercase small tracking-wide" onClick={() => setShowPasswordForm(true)}>
              Changer mon mot de passe
            </button>
          ) : (
            <form onSubmit={handleChangePassword}>
              <h6 className="text-uppercase small tracking-wide text-gold mb-2">Changer mon mot de passe</h6>
              <div className="row g-2">
                <div className="col-sm-4">
                  <input autoComplete="current-password"
                    type="password"
                    className="form-control form-control-sm"
                    placeholder="Mot de passe actuel"
                    value={passwordForm.old_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                    required
                  />
                </div>
                <div className="col-sm-4">
                  <input autoComplete="new-password"
                    type="password"
                    className="form-control form-control-sm"
                    placeholder="Nouveau mot de passe"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    required
                  />
                </div>
                <div className="col-sm-4">
                  <input autoComplete="new-password"
                    type="password"
                    className="form-control form-control-sm"
                    placeholder="Confirmer"
                    value={passwordForm.new_password2}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password2: e.target.value })}
                    required
                  />
                </div>
              </div>
              {passwordError && <div className="alert alert-danger small mt-2 mb-0 py-2">{passwordError}</div>}
              {passwordSaved && <p className="text-success small mt-2 mb-0">Mot de passe modifié.</p>}
              <div className="d-flex gap-2 mt-2">
                <button className="btn btn-sm btn-primary" disabled={savingPassword}>
                  {savingPassword ? 'Enregistrement...' : 'Valider'}
                </button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowPasswordForm(false)}>
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>

        {loyalty && (
          <div className="verse-banner p-4 mb-5 d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <p className="text-uppercase text-gold small tracking-wide mb-1">Programme de fidélité</p>
              <p className="mb-0 text-muted small">
                1 point tous les {loyalty.point_value === 100 ? '1 000' : ''} FCFA dépensés — 1 point = {loyalty.point_value} FCFA de réduction.
              </p>
            </div>
            <p className="h3 font-display text-gold mb-0">{loyalty.balance} pts</p>
          </div>
        )}

        {user?.referral_code && (
          <div className="verse-banner p-4 mb-5">
            <p className="text-uppercase text-gold small tracking-wide mb-1">Parrainage</p>
            <p className="mb-3 text-muted small">
              Partagez votre lien : vos filleul(e)s reçoivent 10 points à l'inscription, et vous recevez 20 points dès leur première commande.
              {user.referrals_count > 0 && ` Déjà ${user.referrals_count} filleul(e)s.`}
            </p>
            <div className="d-flex gap-2 flex-wrap">
              <input className="form-control form-control-sm" style={{ maxWidth: 340 }} readOnly value={referralLink} onFocus={(e) => e.target.select()} />
              <button className="btn btn-sm btn-primary text-uppercase small tracking-wide" onClick={copyReferralLink}>
                {linkCopied ? 'Copié !' : 'Copier le lien'}
              </button>
            </div>
          </div>
        )}

        <h2 className="h4 mb-3">Mes commandes ({orders.count})</h2>
        <ListStatus loading={orders.loading} error={orders.error} onRetry={orders.reload} isEmpty={orders.items.length === 0} emptyText="Aucune commande pour le moment." />
        {orders.items.length > 0 && (
          <div className="mb-5">
            {orders.items.map((o) => (
              <Link
                to={`/commandes/${o.order_number}`}
                key={o.id}
                className="d-flex justify-content-between align-items-center border-bottom py-3 flex-wrap gap-2 text-decoration-none text-dark"
              >
                <div>
                  <strong>{o.order_number}</strong>
                  <div className="text-muted small">
                    {new Date(o.created_at).toLocaleDateString('fr-FR')} — {o.items.length} article{o.items.length > 1 ? 's' : ''}
                  </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <span className="badge badge-brand">{STATUS_LABELS[o.status] || o.status}</span>
                  <span className="fw-semibold text-gold">{Number(o.total).toLocaleString('fr-FR')} FCFA</span>
                  <span className="text-gold">→</span>
                </div>
              </Link>
            ))}
            {orders.hasMore && (
              <div className="text-center mt-3">
                <button type="button" className="btn btn-outline-primary pager-btn px-4" disabled={orders.loadingMore} onClick={orders.loadMore}>
                  {orders.loadingMore ? 'Chargement...' : 'Voir mes commandes plus anciennes'}
                </button>
              </div>
            )}
          </div>
        )}

        <h2 className="h4 mb-3">Mes favoris ({favorites.count})</h2>
        <ListStatus loading={favorites.loading} error={favorites.error} onRetry={favorites.reload} isEmpty={favorites.items.length === 0} emptyText="Aucun favori pour le moment." rows={2} />
        {favorites.items.length > 0 && (
          <>
            <div className="row g-3">
              {favorites.items.map((f) => (
                <div className="col-6 col-md-3" key={f.id}>
                  <Link to={`/produits/${f.product.slug}`} className="text-decoration-none text-dark">
                    <div className="card product-card h-100 shadow-sm">
                      {f.product.main_image ? (
                        <QueuedImage src={f.product.main_image} alt={f.product.name} className="card-img-top" />
                      ) : (
                        <div className="card-img-top d-flex align-items-center justify-content-center text-muted bg-white">
                          Pas d'image
                        </div>
                      )}
                      <div className="card-body">
                        <h6 className="mb-1">{f.product.name}</h6>
                        <p className="mb-0 small fw-semibold text-gold">
                          {f.product.price ? `${Number(f.product.price).toLocaleString('fr-FR')} FCFA` : '—'}
                        </p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
            {favorites.hasMore && (
              <div className="text-center mt-3">
                <button type="button" className="btn btn-outline-primary pager-btn px-4" disabled={favorites.loadingMore} onClick={favorites.loadMore}>
                  {favorites.loadingMore ? 'Chargement...' : 'Voir plus de favoris'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
