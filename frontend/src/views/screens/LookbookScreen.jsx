import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { lookbookAPI } from '../../utils/api';
import useCartStore from '../../store/cart';

export default function LookbookScreen() {
  const navigate = useNavigate();
  const { addVariant } = useCartStore();
  const [looks, setLooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyingLookId, setBuyingLookId] = useState('');

  useEffect(() => {
    lookbookAPI.list().then(({ data }) => {
      setLooks(data);
      setLoading(false);
    });
  }, []);

  const buyTheLook = async (look) => {
    setBuyingLookId(look.id);
    try {
      for (const p of look.products) {
        if (p.default_variant_id) {
          await addVariant(p.default_variant_id, 1);
        }
      }
      navigate('/panier');
    } finally {
      setBuyingLookId('');
    }
  };

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Inspiration</p>
        <h1 className="h1 mb-3">Lookbook</h1>
        <p className="text-muted mx-auto" style={{ maxWidth: 520 }}>
          Des mises en situation pour imaginer vos bijoux au quotidien.
        </p>
      </div>

      <div className="container py-5">
        {loading ? (
          <div aria-busy="true" aria-label="Chargement"><div className="skeleton-block" /></div>
        ) : looks.length === 0 ? (
          <p className="text-center text-muted">Aucun look pour le moment.</p>
        ) : (
          <div className="row g-5">
            {looks.map((look) => (
              <div className="col-md-6 col-lg-4" key={look.id}>
                <img
                  src={look.image}
                  alt={look.title}
                  className="shadow-sm mb-3"
                  style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: 4 }}
                />
                <h2 className="h5 mb-1">{look.title}</h2>
                {look.description && <p className="text-muted small mb-3">{look.description}</p>}

                {look.products.length > 0 && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <p className="text-uppercase small tracking-wide text-gold mb-0">Shoppez le look</p>
                      <button
                        className="btn btn-sm btn-primary text-uppercase small tracking-wide"
                        disabled={buyingLookId === look.id}
                        onClick={() => buyTheLook(look)}
                      >
                        {buyingLookId === look.id ? 'Ajout...' : 'Acheter ce look'}
                      </button>
                    </div>
                    <div className="d-flex flex-column gap-2">
                      {look.products.map((p) => (
                        <Link
                          key={p.id}
                          to={`/produits/${p.slug}`}
                          className="d-flex align-items-center gap-2 text-decoration-none text-dark"
                        >
                          {p.main_image ? (
                            <img src={p.main_image} alt={p.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                          ) : (
                            <div className="bg-white" style={{ width: 44, height: 44, borderRadius: 4 }} />
                          )}
                          <span className="small flex-grow-1">{p.name}</span>
                          <span className="small text-gold fw-semibold">
                            {p.price ? `${Number(p.price).toLocaleString('fr-FR')} FCFA` : ''}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
