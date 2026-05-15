import { buildCalculatorViewModel } from './calculatorViewModel.js';

export function buildCalculationPayload(data, result, { productMap = {}, projectMap = {} } = {}) {
  const prod = productMap[data.product_id];
  const proj = projectMap[data.project_id];
  const clientId = proj?.client_id || prod?.client_id || data.client_id;
  const view = buildCalculatorViewModel(data, result);

  return {
    ...data,
    client_id: clientId,
    price_net: result.priceNet,
    revenue_net: result.revenueNet,
    cogs_base: result.cogsBase,
    cogs_with_waste: result.cogsWithWaste,
    var_cost: result.varCost,
    gross_profit: result.grossProfit,
    gross_margin_pct: result.grossMarginPct,
    marketing_cost: result.marketingCost,
    contribution: result.contribution,
    contribution_pct: result.contributionPct,
    bep_units: view.bep.isReachable ? view.bep.units : null,
    is_profitable: result.isProfitable,
    wb_report: view.wbReport,
  };
}
