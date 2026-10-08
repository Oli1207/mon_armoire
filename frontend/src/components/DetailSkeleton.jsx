/** Squelette d'une fiche (produit, coffret) : même emprise que la page réelle, donc aucun saut à l'arrivée du contenu. */
export default function DetailSkeleton() {
  return (
    <div className="container py-4 py-md-5" aria-busy="true" aria-label="Chargement de la page">
      <div className="row g-4 g-md-5">
        <div className="col-md-6"><div className="skeleton-block" /></div>
        <div className="col-md-6">
          <div className="skeleton-row" style={{ height: '2.2rem', maxWidth: '75%' }} />
          <div className="skeleton-row" style={{ height: '1.6rem', maxWidth: '40%' }} />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
          <div className="skeleton-row" style={{ height: '3rem' }} />
        </div>
      </div>
    </div>
  );
}
