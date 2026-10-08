import { useState } from 'react';
import { adminAPI } from '../../utils/api';
import usePaginated from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';

export default function AdminReviewsScreen() {
  const { items: reviews, count, loading, error, page, pageSize, setPage, reload } = usePaginated(adminAPI.reviews);
  const [actionError, setActionError] = useState('');

  const run = async (action) => {
    setActionError('');
    try {
      await action();
      reload();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Action impossible pour le moment. Veuillez réessayer.');
    }
  };

  const toggle = (review, field) => run(() => adminAPI.updateReview(review.id, { [field]: !review[field] }));

  const handleDelete = (review) => {
    if (!window.confirm(`Supprimer définitivement l'avis de ${review.user_email} sur « ${review.product_name} » ?`)) return;
    run(() => adminAPI.deleteReview(review.id));
  };

  return (
    <div>
      <h1 className="h4 mb-4">Avis clients ({count})</h1>
      {actionError && <div className="alert alert-danger" role="alert">{actionError}</div>}
      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={reviews.length === 0} emptyText="Aucun avis pour le moment." />

      {reviews.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle bg-white">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Client</th>
                <th>Note</th>
                <th>Commentaire</th>
                <th>Photos</th>
                <th>Visible</th>
                <th>Mis en avant</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td>{r.product_name}</td>
                  <td className="small">{r.user_email}</td>
                  <td>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</td>
                  <td className="small">{r.comment}</td>
                  <td>
                    {r.images.length > 0 ? (
                      <div className="d-flex gap-1">
                        {r.images.slice(0, 3).map((img) => (
                          <img key={img.id} src={img.image} alt="" width="32" height="32" loading="lazy" style={{ objectFit: 'cover', borderRadius: 4 }} />
                        ))}
                        {r.images.length > 3 && <span className="small text-muted">+{r.images.length - 3}</span>}
                      </div>
                    ) : (
                      <span className="text-muted small">—</span>
                    )}
                  </td>
                  <td>
                    <input type="checkbox" className="form-check-input" checked={r.is_approved} onChange={() => toggle(r, 'is_approved')} title="Visible publiquement sur le site" aria-label="Avis visible sur le site" />
                  </td>
                  <td>
                    <input type="checkbox" className="form-check-input" checked={r.is_featured} onChange={() => toggle(r, 'is_featured')} title="Mis en avant sur la page d'accueil" aria-label="Avis mis en avant" />
                  </td>
                  <td>
                    <button className="btn btn-sm btn-link text-danger" onClick={() => handleDelete(r)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} count={count} pageSize={pageSize} onChange={setPage} />
    </div>
  );
}
