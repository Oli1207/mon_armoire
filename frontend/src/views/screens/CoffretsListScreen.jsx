import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { coffretsAPI } from '../../utils/api';

export default function CoffretsListScreen() {
  const [coffrets, setCoffrets] = useState([]);

  useEffect(() => {
    coffretsAPI.list().then(({ data }) => setCoffrets(data));
  }, []);

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Offrir la foi, autrement</p>
        <h1 className="h1 mb-0">Coffrets Mon Armoire</h1>
      </div>

      <div className="container py-5">
        {coffrets.length === 0 ? (
          <p className="text-muted text-center">Aucun coffret disponible pour le moment.</p>
        ) : (
          <div className="row g-4">
            {coffrets.map((c) => (
              <div className="col-md-4" key={c.id}>
                <div className="card product-card h-100 shadow-sm">
                  {c.image ? (
                    <img src={c.image} alt={c.name} className="card-img-top" />
                  ) : (
                    <div className="card-img-top d-flex align-items-center justify-content-center text-muted bg-white">
                      Pas d'image
                    </div>
                  )}
                  <div className="card-body">
                    <h6>{c.name}</h6>
                    <p className="text-muted small">{c.description}</p>
                    <p className="fw-semibold text-gold">
                      {c.allow_customization ? 'À partir de ' : ''}{Number(c.starting_price).toLocaleString('fr-FR')} FCFA
                    </p>
                    <Link to={`/coffrets/${c.slug}`} className="btn btn-primary btn-sm text-uppercase small tracking-wide">
                      {c.allow_customization || c.slots?.length > 0 ? 'Composer ce coffret' : 'Voir ce coffret'}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
