import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { symbolsAPI } from '../../utils/api';

export default function SymbolGuideScreen() {
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    symbolsAPI.list().then(({ data }) => {
      setSymbols(data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="py-5 text-center" style={{ backgroundColor: 'var(--ma-cream)' }}>
        <p className="text-uppercase text-gold small tracking-wide mb-2">Comprendre avant de porter</p>
        <h1 className="h1 mb-3">Guide des symboles</h1>
        <p className="text-muted mx-auto" style={{ maxWidth: 520 }}>
          Chaque bijou raconte une histoire. Découvrez la signification des symboles chrétiens
          que vous retrouverez dans nos créations.
        </p>
      </div>

      <div className="container py-5">
        {loading ? (
          <p className="text-center text-muted">Chargement...</p>
        ) : (
          <div className="row g-5">
            {symbols.map((s, i) => (
              <div className="col-md-6" key={s.id}>
                <div className={`d-flex flex-column flex-sm-row gap-4 ${i % 2 === 1 ? 'flex-sm-row-reverse' : ''}`}>
                  {s.image ? (
                    <img
                      src={s.image}
                      alt={s.name}
                      style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                      className="shadow-sm"
                    />
                  ) : (
                    <div className="bg-white" style={{ width: 140, height: 140, borderRadius: 4, flexShrink: 0 }} />
                  )}
                  <div>
                    <h2 className="h5 mb-1">{s.name}</h2>
                    {s.subtitle && <p className="font-script fs-5 text-gold mb-2">{s.subtitle}</p>}
                    <p className="text-muted small mb-2">{s.meaning}</p>
                    {s.category && (
                      <Link
                        to={`/catalogue?category=${s.category.slug}`}
                        className="small text-uppercase tracking-wide text-gold text-decoration-none"
                      >
                        Découvrir les bijoux →
                      </Link>
                    )}
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
