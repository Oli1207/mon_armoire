/** Affiché pendant le chargement d'une page (découpage du code) : même emprise qu'une page réelle, pas de saut. */
export default function PageSkeleton() {
  return (
    <div className="container py-5" aria-busy="true" aria-label="Chargement de la page">
      <div className="skeleton-row" style={{ height: '2.5rem', maxWidth: '16rem' }} />
      <div className="skeleton-row" />
      <div className="skeleton-row" />
      <div className="skeleton-row" />
    </div>
  );
}
