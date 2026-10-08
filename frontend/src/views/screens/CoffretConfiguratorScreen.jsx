import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { coffretsAPI, productsAPI } from '../../utils/api';
import useCartStore from '../../store/cart';
import { useDebounced } from '../../utils/usePaginated';
import { errorText } from '../../utils/errors';
import Suggestions from '../../components/Suggestions';

export default function CoffretConfiguratorScreen() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addCoffretConfiguration } = useCartStore();
  const [coffret, setCoffret] = useState(null);
  const [selections, setSelections] = useState({});
  const [removedIds, setRemovedIds] = useState(new Set());
  const [extraItems, setExtraItems] = useState([]);
  const [extraQuery, setExtraQuery] = useState('');
  const [extraResults, setExtraResults] = useState([]);
  const debouncedQuery = useDebounced(extraQuery.trim());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    coffretsAPI.detail(slug).then(({ data }) => setCoffret(data));
  }, [slug]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setExtraResults([]);
      return;
    }
    let cancelled = false;
    productsAPI.suggest(debouncedQuery)
      .then(({ data }) => { if (!cancelled) setExtraResults(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  if (!coffret) return <div className="container py-5">Chargement...</div>;

  const handleSelect = (slotId, variantId) => {
    setSelections((prev) => ({ ...prev, [slotId]: variantId }));
  };

  const toggleRemoved = (itemId) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const addExtraItem = (product) => {
    if (!product.default_variant_id) return;
    if (extraItems.some((e) => e.variant === product.default_variant_id)) return;
    setExtraItems((prev) => [...prev, {
      variant: product.default_variant_id, name: product.name, price: product.price, quantity: 1,
    }]);
    setExtraQuery('');
    setExtraResults([]);
  };

  const removeExtraItem = (variantId) => {
    setExtraItems((prev) => prev.filter((e) => e.variant !== variantId));
  };

  const hasChoicesToMake = coffret.slots.length > 0;
  const allSlotsFilled = coffret.slots.every((s) => selections[s.id]);
  const hasCustomizationTools = coffret.allow_customization && coffret.show_contents;

  const computeTotal = () => {
    let total = Number(coffret.box_price);
    coffret.included_items.forEach((item) => {
      if (!removedIds.has(item.id)) total += Number(item.variant.price) * item.quantity;
    });
    coffret.slots.forEach((s) => {
      const variant = s.eligible_variants.find((v) => v.id === selections[s.id]);
      if (variant) total += Number(variant.price);
    });
    extraItems.forEach((e) => { total += Number(e.price) * e.quantity; });
    return total;
  };

  const scrollToOptions = () => {
    document.getElementById('coffret-options')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async () => {
    if (!allSlotsFilled) {
      scrollToOptions();
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        coffret: coffret.id,
        selections: coffret.slots.map((s) => ({ slot: s.id, variant: selections[s.id], quantity: 1 })),
        removed_item_ids: [...removedIds],
        extra_items: extraItems.map((e) => ({ variant: e.variant, quantity: e.quantity })),
      };
      const { data: configuration } = await coffretsAPI.configure(payload);
      await addCoffretConfiguration(configuration.id);
      navigate('/panier');
    } catch (err) {
      setError(errorText(err, 'Le coffret n’a pas pu être enregistré. Vérifiez vos choix puis réessayez.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Fonction (et non composant) : un composant défini ici serait recréé à chaque affichage et perdrait son état
  const renderCta = ({ block } = {}) => (
    <button
      className={`btn btn-primary text-uppercase small tracking-wide px-4 ${block ? 'w-100' : ''}`}
      disabled={submitting}
      onClick={handleSubmit}
    >
      {submitting
        ? 'Ajout...'
        : hasChoicesToMake && !allSlotsFilled
          ? 'Personnaliser mon coffret'
          : 'Ajouter ce coffret au panier'}
    </button>
  );

  return (
    <div className="container py-5">
      <div className="row g-5 mb-4">
        <div className="col-md-5">
          {coffret.image ? (
            <img src={coffret.image} alt={coffret.name} className="img-fluid shadow-sm" style={{ borderRadius: 4, aspectRatio: '1/1', objectFit: 'cover', width: '100%' }} />
          ) : (
            <div className="bg-white" style={{ aspectRatio: '1/1', borderRadius: 4 }} />
          )}
        </div>
        <div className="col-md-7 d-flex flex-column">
          <p className="text-uppercase text-gold small tracking-wide mb-2">
            {coffret.show_contents ? 'Coffret' : 'Coffret surprise'}
            {coffret.allow_customization && ' personnalisable'}
          </p>
          <h1 className="h2 mb-2">{coffret.name}</h1>
          <p className="text-muted">{coffret.description}</p>

          {coffret.show_contents && coffret.included_items.length > 0 && (
            <div className="mt-2 mb-3">
              <p className="text-uppercase small tracking-wide text-gold mb-2">Ce coffret contient</p>
              <ul className="list-unstyled mb-0 small">
                {coffret.included_items.map((item) => (
                  <li key={item.id} className="d-flex align-items-center gap-2 mb-2">
                    {item.product_image ? (
                      <img src={item.product_image} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                    ) : (
                      <div className="bg-white border" style={{ width: 36, height: 36, borderRadius: 4, flexShrink: 0 }} />
                    )}
                    <span>{item.quantity} × {item.product_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasChoicesToMake && (
            <p className="small mb-3">
              <button type="button" className="btn btn-link p-0 text-gold" onClick={scrollToOptions}>
                {allSlotsFilled ? '✓ Votre coffret est prêt' : 'Vous pouvez personnaliser votre coffret ci-dessous ↓'}
              </button>
            </p>
          )}

          <div className="mt-auto pt-3 border-top">
            <p className="fs-4 fw-semibold text-gold mb-3">Total : {computeTotal().toLocaleString('fr-FR')} FCFA</p>
            {renderCta()}
          </div>
        </div>
      </div>

      {(hasChoicesToMake || hasCustomizationTools) && (
        <div id="coffret-options" className="p-4 mb-4" style={{ backgroundColor: 'var(--ma-cream)', borderRadius: 4 }}>
          <h2 className="h5 mb-4">Personnalisez votre coffret</h2>

          {coffret.show_contents && coffret.allow_customization && coffret.included_items.length > 0 && (
            <div className="mb-4">
              <h6 className="text-uppercase small tracking-wide">Retirer un élément inclus (facultatif)</h6>
              <div className="d-flex flex-column gap-2">
                {coffret.included_items.map((item) => (
                  <label
                    key={item.id}
                    className={`d-flex justify-content-between align-items-center p-2 border rounded bg-white ${removedIds.has(item.id) ? 'opacity-50' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="d-flex align-items-center gap-2 small">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={!removedIds.has(item.id)}
                        onChange={() => toggleRemoved(item.id)}
                      />
                      {item.product_image ? (
                        <img src={item.product_image} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} />
                      ) : (
                        <div className="bg-white border" style={{ width: 36, height: 36, borderRadius: 4 }} />
                      )}
                      {item.quantity} × {item.product_name}
                      {item.variant.label !== 'Standard' && <span className="text-muted"> ({item.variant.label})</span>}
                    </span>
                    {coffret.show_item_prices && (
                      <span className="small text-gold fw-semibold">
                        {Number(item.variant.price * item.quantity).toLocaleString('fr-FR')} FCFA
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {coffret.slots.map((slot) => (
            <div className="mb-4" key={slot.id}>
              <h6 className="text-uppercase small tracking-wide">
                {slot.label} {!selections[slot.id] && <span className="text-danger">*</span>}
              </h6>
              <div className="d-flex gap-2 flex-wrap">
                {slot.eligible_variants.map((v) => (
                  <button
                    key={v.id}
                    className={`btn btn-sm d-flex align-items-center gap-2 ${selections[slot.id] === v.id ? 'btn-primary' : 'btn-outline-primary bg-white'}`}
                    onClick={() => handleSelect(slot.id, v.id)}
                  >
                    {v.product_image && (
                      <img src={v.product_image} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 3 }} />
                    )}
                    {v.product_name ? `${v.product_name} — ` : ''}{v.label} — {Number(v.price).toLocaleString('fr-FR')} FCFA
                  </button>
                ))}
                {slot.eligible_variants.length === 0 && (
                  <p className="text-muted small">Aucun article disponible pour cet emplacement.</p>
                )}
              </div>
            </div>
          ))}

          {coffret.allow_customization && (
            <div>
              <h6 className="text-uppercase small tracking-wide">Ajouter un article en plus (facultatif)</h6>
              {extraItems.length > 0 && (
                <div className="d-flex flex-column gap-2 mb-2">
                  {extraItems.map((e) => (
                    <div key={e.variant} className="d-flex justify-content-between align-items-center p-2 border rounded bg-white">
                      <span className="small">{e.name}</span>
                      <div className="d-flex align-items-center gap-2">
                        <span className="small text-gold fw-semibold">{Number(e.price).toLocaleString('fr-FR')} FCFA</span>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => removeExtraItem(e.variant)}>Retirer</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="position-relative" style={{ maxWidth: '26rem' }}>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Chercher un bijou à ajouter (ex : croix, chapelet)"
                  aria-label="Chercher un bijou à ajouter au coffret"
                  value={extraQuery}
                  onChange={(e) => setExtraQuery(e.target.value)}
                />
                {extraResults.length > 0 && (
                  <div className="search-suggestions">
                    {extraResults.map((p) => (
                      <button key={p.id} type="button" className="search-suggestion-item" onClick={() => addExtraItem(p)}>
                        {p.main_image ? <img src={p.main_image} alt="" /> : <span className="search-suggestion-noimg" />}
                        <span className="flex-grow-1 text-start">
                          <span className="d-block small">{p.name}</span>
                          {p.price && <span className="d-block small text-gold">{Number(p.price).toLocaleString('fr-FR')} FCFA</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      {(hasChoicesToMake || hasCustomizationTools) && (
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 pt-3" style={{ borderTop: '2px solid var(--ma-brown)' }}>
          <p className="fs-5 fw-semibold text-gold mb-0">Total : {computeTotal().toLocaleString('fr-FR')} FCFA</p>
          {renderCta()}
        </div>
      )}

      <div className="mt-5 pt-4 border-top">
        <Suggestions title="À offrir avec votre coffret" lead="Quelques bijoux de la boutique qui se marient bien avec un cadeau." />
      </div>
    </div>
  );
}
