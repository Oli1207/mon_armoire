/** États communs d'une liste : chargement (squelette), erreur avec « Réessayer », liste vide. */
export default function ListStatus({ loading, error, onRetry, isEmpty, emptyText = 'Rien à afficher pour le moment.', rows = 4 }) {
  if (error) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center gap-3" role="alert">
        <span>{error}</span>
        {onRetry && <button type="button" className="btn btn-sm btn-outline-primary flex-shrink-0" onClick={onRetry}>Réessayer</button>}
      </div>
    );
  }
  if (loading && isEmpty) {
    return (
      <div aria-busy="true" aria-label="Chargement en cours">
        {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton-row" />)}
      </div>
    );
  }
  if (!loading && isEmpty) return <p className="text-center text-muted py-4">{emptyText}</p>;
  return null;
}
