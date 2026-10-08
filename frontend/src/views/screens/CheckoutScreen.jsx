import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useCartStore from '../../store/cart';
import useAuthStore from '../../store/auth';
import { addressesAPI, deliveryZonesAPI, ordersAPI, giftcardsAPI, loyaltyAPI } from '../../utils/api';

const CART_ID_KEY = 'ma_cart_id';

export default function CheckoutScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { cart, fetchCart } = useCartStore();
  const [addresses, setAddresses] = useState([]);
  const [zones, setZones] = useState([]);
  const [deliveryMethod, setDeliveryMethod] = useState('shipping');
  const [addressId, setAddressId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ full_name: '', phone: '', city: '', street: '' });

  // ── Invité : coordonnées + création de compte optionnelle ──────────────────
  const [guest, setGuest] = useState({ full_name: '', email: '', phone: '', city: '', street: '' });
  const [createAccount, setCreateAccount] = useState(false);

  // ── Carte cadeau ─────────────────────────────────────────────────────────
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCard, setGiftCard] = useState(null);
  const [giftCardError, setGiftCardError] = useState('');
  const [checkingGiftCard, setCheckingGiftCard] = useState(false);

  const checkGiftCard = async () => {
    if (!giftCardCode.trim()) return;
    setGiftCardError('');
    setCheckingGiftCard(true);
    try {
      const { data } = await giftcardsAPI.check(giftCardCode.trim());
      if (data.valid) {
        setGiftCard(data);
      } else {
        setGiftCard(null);
        setGiftCardError('Code invalide, déjà utilisé ou expiré.');
      }
    } catch {
      setGiftCardError('Erreur lors de la vérification.');
    } finally {
      setCheckingGiftCard(false);
    }
  };

  // ── Points de fidélité ───────────────────────────────────────────────────
  const [loyalty, setLoyalty] = useState(null);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  useEffect(() => {
    fetchCart();
    deliveryZonesAPI.list().then(({ data }) => {
      setZones(data);
      if (data[0]) setZoneId(data[0].id);
    });
    if (isAuthenticated) {
      addressesAPI.list().then(({ data }) => {
        setAddresses(data);
        const def = data.find((a) => a.is_default) || data[0];
        if (def) setAddressId(def.id);
        if (data.length === 0) setShowNewAddress(true);
      });
      loyaltyAPI.balance().then(({ data }) => setLoyalty(data));
    }
  }, [isAuthenticated]);

  const afterGiftCard = cart ? Math.max(0, cart.total - (giftCard ? Math.min(giftCard.balance, cart.total) : 0)) : 0;
  const maxUsablePoints = loyalty ? Math.min(loyalty.balance, Math.floor(afterGiftCard / loyalty.point_value)) : 0;
  const loyaltyDiscount = useLoyaltyPoints ? maxUsablePoints * (loyalty?.point_value || 0) : 0;

  const handleAddAddress = async () => {
    const { data } = await addressesAPI.create(newAddress);
    setAddresses((prev) => [...prev, data]);
    setAddressId(data.id);
    setShowNewAddress(false);
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        cart_id: localStorage.getItem(CART_ID_KEY),
        delivery_method: deliveryMethod,
      };
      if (giftCard) {
        payload.gift_card_code = giftCard.code;
      }
      if (useLoyaltyPoints && maxUsablePoints > 0) {
        payload.loyalty_points = maxUsablePoints;
      }
      if (isAuthenticated) {
        if (deliveryMethod === 'shipping') {
          payload.address_id = addressId;
          payload.delivery_zone_id = zoneId;
        }
      } else {
        payload.full_name = guest.full_name;
        payload.email = guest.email;
        payload.phone = guest.phone;
        payload.create_account = createAccount;
        if (deliveryMethod === 'shipping') {
          payload.city = guest.city;
          payload.street = guest.street;
          payload.delivery_zone_id = zoneId;
        }
      }
      const { data: order } = await ordersAPI.create(payload);
      navigate(`/commandes/${order.order_number}`, { state: { order } });
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création de la commande.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = isAuthenticated
    ? !(deliveryMethod === 'shipping' && (!addressId || !zoneId))
    : guest.full_name && guest.email && guest.phone && !(deliveryMethod === 'shipping' && (!guest.city || !guest.street || !zoneId));

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Dernière étape</p>
        <h1 className="h1 mb-0">Finaliser la commande</h1>
      </div>

      <div className="container py-5" style={{ maxWidth: 620 }}>
        {!cart ? (
          <p className="text-center text-muted">Chargement...</p>
        ) : cart.items.length === 0 ? (
          <p className="text-center text-muted">Votre panier est vide.</p>
        ) : (
          <>
            <div className="card p-4 mb-4 shadow-sm">
              <h6 className="text-uppercase small tracking-wide text-gold mb-3">Récapitulatif ({cart.items.length} article{cart.items.length > 1 ? 's' : ''})</h6>
              {cart.items.map((item) => (
                <div className="d-flex align-items-center gap-3 border-bottom py-2" key={item.id}>
                  {item.product_image ? (
                    <img src={item.product_image} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                  ) : (
                    <div className="bg-white" style={{ width: 48, height: 48, borderRadius: 4, flexShrink: 0 }} />
                  )}
                  <div className="flex-grow-1 d-flex justify-content-between small">
                    <span>
                      {item.product_name || `Coffret personnalisé — ${item.coffret_configuration.coffret.name}`}
                      {item.quantity > 1 && ` × ${item.quantity}`}
                    </span>
                    <span className="text-gold fw-semibold">{Number(item.subtotal).toLocaleString('fr-FR')} FCFA</span>
                  </div>
                </div>
              ))}
            </div>

            {!isAuthenticated && (
              <div className="card p-4 mb-4 shadow-sm">
                <h6 className="text-uppercase small tracking-wide text-gold mb-3">Vos coordonnées</h6>
                <input autoComplete="name"
                  className="form-control mb-2"
                  placeholder="Nom complet"
                  value={guest.full_name}
                  onChange={(e) => setGuest({ ...guest, full_name: e.target.value })}
                />
                <input autoComplete="email" inputMode="email"
                  type="email"
                  className="form-control mb-2"
                  placeholder="Email"
                  value={guest.email}
                  onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                />
                <input type="tel" autoComplete="tel" inputMode="tel"
                  className="form-control mb-2"
                  placeholder="Téléphone"
                  value={guest.phone}
                  onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
                />
                <div className="form-check mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="createAccount"
                    checked={createAccount}
                    onChange={(e) => setCreateAccount(e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="createAccount">
                    Créer un compte pour suivre mes commandes (les identifiants seront envoyés par email)
                  </label>
                </div>
              </div>
            )}

            <div className="card p-4 mb-4 shadow-sm">
              <h6 className="text-uppercase small tracking-wide text-gold mb-3">Mode de récupération</h6>
              <div className="d-flex gap-2">
                <button
                  className={`btn btn-sm ${deliveryMethod === 'shipping' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setDeliveryMethod('shipping')}
                >
                  Livraison
                </button>
                <button
                  className={`btn btn-sm ${deliveryMethod === 'pickup' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setDeliveryMethod('pickup')}
                >
                  Retrait en boutique
                </button>
              </div>
            </div>

            {deliveryMethod === 'shipping' && isAuthenticated && (
              <div className="card p-4 mb-4 shadow-sm">
                <h6 className="text-uppercase small tracking-wide text-gold mb-3">Adresse de livraison</h6>
                {addresses.map((a) => (
                  <div className="form-check" key={a.id}>
                    <input
                      className="form-check-input"
                      type="radio"
                      name="address"
                      id={`address-${a.id}`}
                      checked={addressId === a.id}
                      onChange={() => setAddressId(a.id)}
                    />
                    <label className="form-check-label" htmlFor={`address-${a.id}`}>
                      {a.full_name} — {a.city}, {a.street}
                    </label>
                  </div>
                ))}
                <button className="btn btn-link btn-sm p-0 mt-2" onClick={() => setShowNewAddress((v) => !v)}>
                  + Nouvelle adresse
                </button>
                {showNewAddress && (
                  <div className="border rounded p-3 mt-2">
                    <input autoComplete="name"
                      className="form-control form-control-sm mb-2"
                      placeholder="Nom complet"
                      value={newAddress.full_name}
                      onChange={(e) => setNewAddress({ ...newAddress, full_name: e.target.value })}
                    />
                    <input type="tel" autoComplete="tel" inputMode="tel"
                      className="form-control form-control-sm mb-2"
                      placeholder="Téléphone"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                    />
                    <input autoComplete="address-level2"
                      className="form-control form-control-sm mb-2"
                      placeholder="Ville"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    />
                    <input autoComplete="street-address"
                      className="form-control form-control-sm mb-2"
                      placeholder="Quartier / rue"
                      value={newAddress.street}
                      onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                    />
                    <button className="btn btn-sm btn-primary" onClick={handleAddAddress}>
                      Enregistrer l'adresse
                    </button>
                  </div>
                )}
              </div>
            )}

            {deliveryMethod === 'shipping' && !isAuthenticated && (
              <div className="card p-4 mb-4 shadow-sm">
                <h6 className="text-uppercase small tracking-wide text-gold mb-3">Adresse de livraison</h6>
                <input autoComplete="address-level2"
                  className="form-control mb-2"
                  placeholder="Ville"
                  value={guest.city}
                  onChange={(e) => setGuest({ ...guest, city: e.target.value })}
                />
                <input autoComplete="street-address"
                  className="form-control mb-2"
                  placeholder="Quartier / rue"
                  value={guest.street}
                  onChange={(e) => setGuest({ ...guest, street: e.target.value })}
                />
              </div>
            )}

            {deliveryMethod === 'shipping' && (
              <div className="card p-4 mb-4 shadow-sm">
                <h6 className="text-uppercase small tracking-wide text-gold mb-3">Zone de livraison</h6>
                {zones.map((z) => (
                  <div className="form-check" key={z.id}>
                    <input
                      className="form-check-input"
                      type="radio"
                      name="zone"
                      id={`zone-${z.id}`}
                      checked={zoneId === z.id}
                      onChange={() => setZoneId(z.id)}
                    />
                    <label className="form-check-label" htmlFor={`zone-${z.id}`}>
                      {z.name} — {Number(z.shipping_cost).toLocaleString('fr-FR')} FCFA ({z.estimated_days_min}-{z.estimated_days_max} j)
                    </label>
                  </div>
                ))}
              </div>
            )}

            <div className="card p-4 mb-4 shadow-sm">
              <h6 className="text-uppercase small tracking-wide text-gold mb-3">Carte cadeau</h6>
              {giftCard ? (
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small">
                    Code <strong>{giftCard.code}</strong> — solde {Number(giftCard.balance).toLocaleString('fr-FR')} FCFA
                  </span>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => { setGiftCard(null); setGiftCardCode(''); }}>
                    Retirer
                  </button>
                </div>
              ) : (
                <div className="d-flex gap-2">
                  <input autoComplete="off" autoCapitalize="characters" spellCheck={false}
                    className="form-control"
                    placeholder="Code de la carte cadeau"
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                  />
                  <button className="btn btn-outline-primary text-uppercase small tracking-wide" disabled={checkingGiftCard} onClick={checkGiftCard}>
                    {checkingGiftCard ? '...' : 'Appliquer'}
                  </button>
                </div>
              )}
              {giftCardError && <p className="text-danger small mb-0 mt-2">{giftCardError}</p>}
            </div>

            {isAuthenticated && loyalty && loyalty.balance > 0 && (
              <div className="card p-4 mb-4 shadow-sm">
                <h6 className="text-uppercase small tracking-wide text-gold mb-3">Points de fidélité</h6>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="useLoyalty"
                    checked={useLoyaltyPoints}
                    onChange={(e) => setUseLoyaltyPoints(e.target.checked)}
                    disabled={maxUsablePoints === 0}
                  />
                  <label className="form-check-label small" htmlFor="useLoyalty">
                    Utiliser mes {loyalty.balance} points ({maxUsablePoints > 0 ? `jusqu'à ${maxUsablePoints} points applicables sur cette commande` : 'insuffisant pour cette commande'})
                  </label>
                </div>
              </div>
            )}

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="pt-3" style={{ borderTop: '2px solid var(--ma-brown)' }}>
              {giftCard && (
                <div className="d-flex justify-content-between align-items-center mb-2 text-gold small">
                  <span>Carte cadeau</span>
                  <span>−{Number(Math.min(giftCard.balance, cart.total)).toLocaleString('fr-FR')} FCFA</span>
                </div>
              )}
              {loyaltyDiscount > 0 && (
                <div className="d-flex justify-content-between align-items-center mb-2 text-gold small">
                  <span>Points de fidélité ({maxUsablePoints} pts)</span>
                  <span>−{Number(loyaltyDiscount).toLocaleString('fr-FR')} FCFA</span>
                </div>
              )}
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="mb-0 font-display">Total à payer</h5>
                <h5 className="mb-0 font-display text-gold">
                  {Number(Math.max(0, afterGiftCard - loyaltyDiscount)).toLocaleString('fr-FR')} FCFA
                </h5>
              </div>
            </div>

            <button
              className="btn btn-primary w-100 py-2 text-uppercase small tracking-wide"
              disabled={submitting || !canSubmit}
              onClick={handleSubmit}
            >
              {submitting ? 'Validation...' : 'Confirmer la commande'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
