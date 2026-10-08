export default function Pager({ page, count, pageSize = 20, onChange }) {
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  if (pageCount <= 1) return null;

  const go = (next) => {
    onChange(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav aria-label="Pagination" className="d-flex justify-content-between align-items-center gap-2 mt-3">
      <button type="button" className="btn btn-outline-secondary pager-btn" disabled={page <= 1} onClick={() => go(page - 1)}>
        ← Précédent
      </button>
      <span className="small text-muted text-center">Page {page} sur {pageCount}</span>
      <button type="button" className="btn btn-outline-secondary pager-btn" disabled={page >= pageCount} onClick={() => go(page + 1)}>
        Suivant →
      </button>
    </nav>
  );
}
