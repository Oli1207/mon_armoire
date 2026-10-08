import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { giftcardsAPI } from '../../utils/api';
import useAuthStore from '../../store/auth';

const AMOUNTS = [10000, 25000, 50000];

export default function GiftCardsScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [amount, setAmount] = useState(25000);
  const [customAmount, setCustomAmount] = useState('');
  const [purchaserName, setPurchaserName] = useState(user?.full_name || '');
  const [purchaserEmail, setPurchaserEmail] = useState(user?.email || '');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const finalAmount = customAmount ? Number(customAmount) : amount;
  const canSubmit = finalAmount >= 5000 && (isAuthenticated || purchaserEmail.trim());

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const { data: order } = await giftcardsAPI.purchase({
        amount: finalAmount,
        purchaser_name: purchaserName,
        purchaser_email: purchaserEmail,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        message,
      });
      navigate(`/commandes/${order.order_number}`, { state: { order } });
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'achat de la carte cadeau.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Offrir sans se tromper</p>
        <h1 className="h1 mb-3">Cartes cadeaux</h1>
        <p className="text-muted mx-auto" style={{ maxWidth: 480 }}>
          Laissez la personne choisir elle-même son bijou. Valable sur tout le site, en une ou plusieurs fois.
        </p>
      </div>

      <div className="container py-5" style={{ maxWidth: 560 }}>
        <div className="giftcard-visual mb-5">
          <span className="giftcard-visual-brand font-script">Mon Armoire</span>
          <span className="giftcard-visual-label">Carte cadeau</span>
          <span className="giftcard-visual-amount">{(finalAmount || 0).toLocaleString('fr-FR')} FCFA</span>
        </div>

        <h2 className="h6 text-uppercase small tracking-wide text-gold mb-3">Montant</h2>
        <div className="d-flex gap-2 flex-wrap mb-3">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              className={`btn btn-sm px-3 text-uppercase small tracking-wide ${!customAmount && amount === a ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => { setAmount(a); setCustomAmount(''); }}
            >
              {a.toLocaleString('fr-FR')} FCFA
            </button>
          ))}
        </div>
        <input inputMode="numeric"
          type="number"
          className="form-control mb-5"
          placeholder="Autre montant (minimum 5 000 FCFA)"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
        />

        {!isAuthenticated && (
          <>
            <h2 className="h6 text-uppercase small tracking-wide text-gold mb-3">Vos coordonnées</h2>
            <input autoComplete="name"
              className="form-control mb-2"
              placeholder="Votre nom"
              value={purchaserName}
              onChange={(e) => setPurchaserName(e.target.value)}
            />
            <input autoComplete="email" inputMode="email"
              type="email"
              className="form-control mb-5"
              placeholder="Votre email"
              value={purchaserEmail}
              onChange={(e) => setPurchaserEmail(e.target.value)}
            />
          </>
        )}

        <h2 className="h6 text-uppercase small tracking-wide text-gold mb-3">À offrir à (facultatif)</h2>
        <input autoComplete="off"
          className="form-control mb-2"
          placeholder="Nom du destinataire"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
        />
        <input autoComplete="off" inputMode="email"
          type="email"
          className="form-control mb-2"
          placeholder="Email du destinataire (la carte lui sera envoyée directement)"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
        />
        <textarea
          className="form-control mb-5"
          placeholder="Un petit mot (facultatif)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        {error && <div className="alert alert-danger">{error}</div>}

        <div className="d-flex justify-content-between align-items-center mb-4 pt-3" style={{ borderTop: '2px solid var(--ma-brown)' }}>
          <h5 className="mb-0 font-display">Total</h5>
          <h5 className="mb-0 font-display text-gold">{(finalAmount || 0).toLocaleString('fr-FR')} FCFA</h5>
        </div>

        <button
          className="btn btn-primary w-100 py-2 text-uppercase small tracking-wide"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Validation...' : 'Acheter cette carte cadeau'}
        </button>
        <p className="text-muted small text-center mt-3 mb-0">
          Le code sera envoyé par email dès le paiement confirmé — au destinataire directement si vous avez renseigné son adresse, sinon à vous.
        </p>
      </div>
    </div>
  );
}
