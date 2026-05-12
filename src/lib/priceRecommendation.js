import { calculate } from './unitEconomics.js';

const hasAnyCost = (result = {}) => (
  (result.varCost || 0) > 0 ||
  (result.wbFee || 0) > 0 ||
  (result.tax || 0) > 0 ||
  (result.acquiring || 0) > 0 ||
  (result.promo || 0) > 0 ||
  (result.returnLossPerSale || 0) > 0 ||
  (result.marketingCost || 0) > 0
);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function calculateRecommendedPrice(form, result, { targetMarginPct = 30, metric = 'contribution' } = {}) {
  const target = clamp(Number(targetMarginPct) || 0, 0, 95) / 100;
  const metricKey = metric === 'gross' ? 'grossMarginPct' : 'contributionPct';

  if (!hasAnyCost(result)) return 0;

  let low = 0;
  let high = Math.max(Number(form.price) || 0, result.varCost || 0, result.cogsWithWaste || 0, 100);
  while (high < 10_000_000) {
    const projected = calculate({ ...form, price: high });
    if ((projected[metricKey] || 0) >= target) break;
    high *= 2;
  }

  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    const projected = calculate({ ...form, price: mid });
    if ((projected[metricKey] || 0) >= target) high = mid;
    else low = mid;
  }

  let rounded = Math.round(high * 100) / 100;
  for (let i = 0; i < 100; i += 1) {
    const projected = calculate({ ...form, price: rounded });
    if ((projected[metricKey] || 0) >= target) break;
    rounded = Math.round((rounded + 0.01) * 100) / 100;
  }

  return rounded;
}
