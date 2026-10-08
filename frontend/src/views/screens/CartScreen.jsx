import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useCartStore from '../../store/cart';
import ListStatus from '../../components/ListStatus';
import Suggestions from '../../components/Suggestions';
import { errorText } from '../../utils/errors';

export default function CartScreen() {
  const { cart, loading, error: loadError, fetchCart, updateItem, removeItem } = useCartStore();
  const [error, setError] = useState('');

  const change = async (action) => {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(errorText(err));
      fetchCart();
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const items = cart?.items || [];
  const suggestionKey = [...new Set(items.map((i) => i.product_slug).filter(Boolean))].sort();

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Votre sélection</p>
        <h1 className="h1 mb-0">Mon panier</h1>
      </div>

      <div className="container py-5" style={{ maxWidth: '50rem' }}>
        {!cart ? (
          <ListStatus loading={loading || !loadError} error={loadError} onRetry={fetchCart} isEmpty rows={3} />
        ) : items.length === 0 ? (
          <p className="text-center text-muted">
            Votre panier est vide. <Link to="/catalogue" className="link-tap text-gold">Voir les bijoux</Link>
          </p>
        ) : (
          <>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            {items.map((item) => (
              <div className="d-flex justify-content-between align-items-center border-bottom py-3 flex-wrap gap-3" key={item.id}>
                <div className="d-flex align-items-center gap-3">
                  {item.product_image ? (
                    <img src={item.product_image} alt="" className="cart-thumb" loading="lazy" />
                  ) : (
                    <div className="cart-thumb bg-white" />
                  )}
                  <div>
                    <strong>
                      {item.product_name || `Coffret personnalisé — ${item.coffret_configuration.coffret.name}`}
                    </strong>
                    {item.variant && <div className="text-muted small">{item.variant.label}</div>}
                    <div className="form-check mt-1">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`wrap-${item.id}`}
                        checked={item.gift_wrap}
                        onChange={(e) => change(() => updateItem(item.id, { gift_wrap: e.target.checked }))}
                      />
                      <label className="form-check-label small" htmlFor={`wrap-${item.id}`}>
                        Emballage cadeau
                      </label>
                    </div>
                    {item.variant && (
                      <input
                        className="form-control form-control-sm mt-1"
                        style={{ maxWidth: '16rem' }}
                        placeholder="Texte de gravure (facultatif)"
                        aria-label="Texte de gravure"
                        maxLength={60}
                        defaultValue={item.engraving_text}
                        onBlur={(e) => {
                          if (e.target.value !== item.engraving_text) {
                            change(() => updateItem(item.id, { engraving_text: e.target.value }));
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    inputMode="numeric"
                    aria-label="Quantité"
                    className="form-control form-control-sm"
                    style={{ width: '4.5rem' }}
                    value={item.quantity}
                    onChange={(e) => {
                      const quantity = Number(e.target.value);
                      if (Number.isInteger(quantity) && quantity >= 1) change(() => updateItem(item.id, { quantity }));
                    }}
                  />
                  <span className="fw-semibold text-gold">{Number(item.subtotal).toLocaleString('fr-FR')} FCFA</span>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => change(() => removeItem(item.id))}>
                    Retirer
                  </button>
                </div>
              </div>
            ))}
            <div className="d-flex justify-content-between align-items-center mt-4 pt-3" style={{ borderTop: '2px solid var(--ma-brown)' }}>
              <h5 className="mb-0 font-display">Total</h5>
              <h5 className="mb-0 font-display text-gold">{Number(cart.total).toLocaleString('fr-FR')} FCFA</h5>
            </div>
            <Link to="/checkout" className="btn btn-primary mt-4 px-4 text-uppercase small tracking-wide">
              Passer la commande
            </Link>
          </>
        )}
      </div>

      {cart && (
        <div className="container pb-5" style={{ maxWidth: '64rem' }}>
          <Suggestions
            like={suggestionKey}
            title={items.length ? 'Complétez votre commande' : 'Nos bijoux du moment'}
            lead={items.length ? 'D’autres pièces qui s’accordent avec votre sélection.' : undefined}
          />
        </div>
      )}
    </div>
  );
}
