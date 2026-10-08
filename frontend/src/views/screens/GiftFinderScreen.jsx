import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collectionsAPI } from '../../utils/api';

const BUDGETS = [
  { label: 'Moins de 15 000 FCFA', maxPrice: 15000 },
  { label: '15 000 – 25 000 FCFA', maxPrice: 25000 },
  { label: 'Plus de 25 000 FCFA', maxPrice: '' },
];

export default function GiftFinderScreen() {
  const navigate = useNavigate();
  const [occasions, setOccasions] = useState([]);
  const [occasion, setOccasion] = useState('');
  const [budget, setBudget] = useState(null);

  useEffect(() => {
    collectionsAPI.list('occasion').then(({ data }) => setOccasions(data));
  }, []);

  const seeSuggestions = () => {
    const params = new URLSearchParams();
    if (occasion) params.set('collection', occasion);
    if (budget?.maxPrice) params.set('max_price', budget.maxPrice);
    navigate(`/catalogue${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Un cadeau qui a du sens</p>
        <h1 className="h1 mb-3">Je cherche un cadeau</h1>
        <p className="text-muted mx-auto" style={{ maxWidth: 480 }}>
          Précisez l'occasion et votre budget, nous vous proposons une sélection adaptée.
        </p>
      </div>

      <div className="container py-5" style={{ maxWidth: 620 }}>
        <h2 className="h6 text-uppercase small tracking-wide text-gold mb-3">Quelle occasion ?</h2>
        <div className="d-flex gap-2 flex-wrap mb-5">
          <button
            className={`btn btn-sm px-3 text-uppercase small tracking-wide ${!occasion ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setOccasion('')}
          >
            Sans préférence
          </button>
          {occasions.map((o) => (
            <button
              key={o.id}
              className={`btn btn-sm px-3 text-uppercase small tracking-wide ${occasion === o.slug ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setOccasion(o.slug)}
            >
              {o.name}
            </button>
          ))}
        </div>

        <h2 className="h6 text-uppercase small tracking-wide text-gold mb-3">Quel budget ?</h2>
        <div className="d-flex gap-2 flex-wrap mb-5">
          {BUDGETS.map((b) => (
            <button
              key={b.label}
              className={`btn btn-sm px-3 text-uppercase small tracking-wide ${budget?.label === b.label ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setBudget(b)}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="text-center">
          <button className="btn btn-primary px-4 py-2 text-uppercase small tracking-wide" onClick={seeSuggestions}>
            Voir les suggestions
          </button>
        </div>
      </div>
    </div>
  );
}
