import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { paymentsAPI } from '../../utils/api';
import { errorText } from '../../utils/errors';

export default function PaymentReturnScreen() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order_number');
  const provider = searchParams.get('provider');
  const errorParam = searchParams.get('status');

  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (errorParam === 'error') {
      setError('Le paiement a été annulé ou a échoué.');
      setLoading(false);
      return;
    }
    if (!orderNumber || !provider) {
      setError('Paramètres de retour de paiement manquants.');
      setLoading(false);
      return;
    }
    paymentsAPI.verify(orderNumber, provider)
      .then(({ data }) => setResult(data))
      .catch((err) => setError(errorText(err, 'Nous n’avons pas pu vérifier votre paiement. Si vous avez été débitée, contactez-nous avec votre numéro de commande.')))
      .finally(() => setLoading(false));
  }, [orderNumber, provider, errorParam]);

  if (loading) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: 600 }}>
        <p className="text-muted">Vérification du paiement...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Retour de paiement</p>
        <h1 className="h1 mb-0">
          {result?.paid ? 'Paiement confirmé' : 'Vérification'}
        </h1>
      </div>

      <div className="container py-5" style={{ maxWidth: 620 }}>
        {error && <div className="alert alert-danger">{error}</div>}

        {result?.paid && (
          <div className="card p-4 shadow-sm">
            <div className="alert alert-success">Merci pour votre commande !</div>
            <h2 className="h5">{result.order.order_number}</h2>
            <p className="text-muted">Statut : {result.order.status}</p>
            <div className="d-flex justify-content-between align-items-center mt-3 pt-3" style={{ borderTop: '2px solid var(--ma-brown)' }}>
              <h6 className="mb-0 font-display">Total payé</h6>
              <h6 className="mb-0 font-display text-gold">{Number(result.order.total).toLocaleString('fr-FR')} FCFA</h6>
            </div>
          </div>
        )}

        {result && !result.paid && !result.pending && (
          <div className="alert alert-warning">
            Paiement non confirmé pour le moment (statut : {result.status || 'inconnu'}). Réessayez ou contactez-nous avec le numéro {orderNumber}.
          </div>
        )}

        {result?.pending && (
          <div className="alert alert-info">
            Paiement initié. La confirmation peut prendre quelques instants — vous recevrez un email dès que ce sera validé.
          </div>
        )}

        <div className="mt-4">
          <Link to="/suivi" className="btn btn-outline-primary me-2 text-uppercase small tracking-wide">
            Suivre ma commande
          </Link>
          <Link to="/catalogue" className="btn btn-primary text-uppercase small tracking-wide">
            Continuer mes achats
          </Link>
        </div>
      </div>
    </div>
  );
}
