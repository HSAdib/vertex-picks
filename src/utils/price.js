export const resolvePrice = (product, selectedWeightLabel) => {
  let basePrice = Number(product?.price) || 0;
  let baseDiscount = product?.discountPrice ? Number(product.discountPrice) : null;
  
  if (product?.weightOptions && product.weightOptions.length > 0) {
    const opt = product.weightOptions.find(o => (typeof o === 'string' ? o : o.label) === selectedWeightLabel);
    if (opt && typeof opt === 'object') {
      basePrice = Number(opt.price) || basePrice;
      baseDiscount = opt.discountPrice ? Number(opt.discountPrice) : null;
    } else if (!opt) {
      const firstOpt = product.weightOptions[0];
      if (typeof firstOpt === 'object') {
        basePrice = Number(firstOpt.price) || basePrice;
        baseDiscount = firstOpt.discountPrice ? Number(firstOpt.discountPrice) : null;
      }
    }
  }
  
  return {
    displayPrice: baseDiscount || basePrice,
    oldPrice: baseDiscount ? basePrice : null,
    activePriceRaw: baseDiscount || basePrice
  };
};

export const getOptionLabel = (opt) => typeof opt === 'string' ? opt : opt?.label || '';

/**
 * Parses a weight string like "2kg Box" or "500g" into a number in kilograms.
 * Falls back to `fallbackWeight` when the string can't be parsed.
 */
export function parseWeight(selectedWeightStr, fallbackWeight) {
  if (!selectedWeightStr) return fallbackWeight;
  const kgMatch = String(selectedWeightStr).match(/(\d+(?:\.\d+)?)\s*k?g/i);
  if (kgMatch) return Number(kgMatch[1]);
  const gMatch = String(selectedWeightStr).match(/(\d+(?:\.\d+)?)\s*g/i);
  if (gMatch) return Number(gMatch[1]) / 1000;
  return fallbackWeight;
}
