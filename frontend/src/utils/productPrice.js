/** Prix affiché dans une liste : le plus bas, précédé de « Dès » quand le prix dépend de la version choisie. */
export default function priceLabel(product) {
  const value = product.has_price_range ? product.min_price : product.price;
  if (!value) return '';
  const amount = `${Number(value).toLocaleString('fr-FR')} FCFA`;
  return product.has_price_range ? `Dès ${amount}` : amount;
}
