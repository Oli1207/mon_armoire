import { adminAPI } from '../../utils/api';
import usePaginated from '../../utils/usePaginated';
import Pager from '../../components/Pager';
import ListStatus from '../../components/ListStatus';
import { StarRating } from '../../components/Stars';
import { useAdminUi } from './ui/AdminUi';
import { PageHeader, errorText, shortDate } from './ui/parts';

export default function AdminReviewsScreen() {
  const { notify, confirm } = useAdminUi();
  const { items: reviews, count, loading, error, page, pageSize, setPage, reload } = usePaginated(adminAPI.reviews);

  const toggle = async (review, field, successMessage) => {
    try {
      await adminAPI.updateReview(review.id, { [field]: !review[field] });
      notify(successMessage(!review[field]));
      reload();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  const remove = async (review) => {
    const accepted = await confirm({
      title: 'Supprimer cet avis ?',
      message: `Avis de ${review.user_email} sur « ${review.product_name} ». Pour simplement le cacher, décochez « Visible ».`,
      confirmLabel: 'Supprimer', danger: true,
    });
    if (!accepted) return;
    try {
      await adminAPI.deleteReview(review.id);
      notify('Avis supprimé.');
      reload();
    } catch (err) {
      notify(errorText(err), 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Avis clientes"
        lead={`${count} avis. Les avis sont publiés tout de suite : décochez « Visible » pour en cacher un. « En avant » l'affiche sur la page d'accueil.`}
      />

      <ListStatus loading={loading} error={error} onRetry={reload} isEmpty={reviews.length === 0} emptyText="Aucun avis pour le moment." />

      {reviews.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Bijou</th><th>Cliente</th><th>Note</th><th>Commentaire</th><th>Photos</th><th>Visible</th><th>En avant</th><th aria-label="Supprimer" /></tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.product_name}</strong><div className="cell-muted">{shortDate(r.created_at)}</div></td>
                  <td className="cell-muted">{r.user_email}</td>
                  <td><StarRating value={r.rating} /></td>
                  <td style={{ minWidth: '14rem', whiteSpace: 'pre-line' }}>{r.comment || <span className="cell-muted">—</span>}</td>
                  <td>
                    {r.images.length > 0 ? (
                      <div className="d-flex gap-1 align-items-center">
                        {r.images.slice(0, 3).map((img) => <img key={img.id} className="admin-thumb" src={img.image} alt="" loading="lazy" />)}
                        {r.images.length > 3 && <span className="cell-muted">+{r.images.length - 3}</span>}
                      </div>
                    ) : <span className="cell-muted">—</span>}
                  </td>
                  <td>
                    <div className="form-check form-switch mb-0">
                      <input
                        type="checkbox" className="form-check-input" role="switch" checked={r.is_approved}
                        aria-label={`Avis de ${r.user_email} visible sur le site`}
                        onChange={() => toggle(r, 'is_approved', (on) => (on ? 'Avis visible sur le site.' : 'Avis caché.'))}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="form-check form-switch mb-0">
                      <input
                        type="checkbox" className="form-check-input" role="switch" checked={r.is_featured}
                        aria-label={`Avis de ${r.user_email} mis en avant sur l'accueil`}
                        onChange={() => toggle(r, 'is_featured', (on) => (on ? "Avis mis en avant sur l'accueil." : "Avis retiré de l'accueil."))}
                      />
                    </div>
                  </td>
                  <td className="cell-actions"><button type="button" className="admin-link is-danger" onClick={() => remove(r)}>Supprimer</button></td>
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
