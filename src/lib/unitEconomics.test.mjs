import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculate,
  calculateWbReportMetrics,
  formatPct,
  normalizeUnitEconomicsInput,
} from './unitEconomics.js';
import { buildCalculationPayload } from './calculationPayload.js';
import {
  CALCULATOR_INPUT_PLACEMENTS,
  getCalculatorParameterDoc,
} from './calculatorParameterDocs.js';
import { applyFulfillmentModeSeed, buildCalculatorSeed } from './calculatorSeed.js';
import {
  buildCalculatorViewModel,
  getLogisticsSensitivityField,
} from './calculatorViewModel.js';
import { buildCalculatorAdvice } from './calculatorAdvice.js';
import { calculateRecommendedPrice } from './priceRecommendation.js';
import {
  calculateBoxesPerPallet,
  calculateLogisticsCost,
  checkFulfillmentCompatibility,
  getPalletDimensions,
  getTariffs,
} from './LogisticsService.js';

describe('unitEconomics donor parity', () => {
  it('treats input price as final sale price after discount', () => {
    const result = calculate({
      fulfillmentMode: 'FBO',
      price: 1000,
      discountPct: 50,
      wbCommissionPct: 10,
      taxPct: 5,
    });

    assert.equal(result.priceNet, 1000);
    assert.equal(result.wbFee, 100);
    assert.equal(result.tax, 50);
    assert.equal(result.revenueNet, 850);
    assert.equal(result.grossMarginPct, 0.85);
  });

  it('maps current project usn_income to donor income tax basis', () => {
    const result = calculate({
      fulfillment_mode: 'FBO',
      tax_system: 'usn_income',
      price: 1000,
      wb_commission_pct: 10,
      tax_pct: 6,
      acquiring_pct: 2,
      promo_pct: 1,
    });

    assert.equal(result.taxBase, 1000);
    assert.equal(result.businessTax, 60);
    assert.equal(result.tax, 60);
    assert.equal(result.revenueNet, 810);
  });

  it('maps current project usn_income_expense to donor income-expense tax basis', () => {
    const result = calculate({
      fulfillment_mode: 'FBO',
      tax_system: 'usn_income_expense',
      price: 1000,
      wb_commission_pct: 10,
      tax_pct: 15,
      acquiring_pct: 2,
      promo_pct: 1,
      return_rate_pct: 10,
      return_loss: 100,
      cogs_purchase: 200,
      cogs_packaging: 50,
      cac: 50,
      paid_share_pct: 100,
      fbo_wb_logistics: 100,
    });

    assert.equal(result.taxBase, 460);
    assert.equal(result.businessTax, 69);
    assert.equal(result.tax, 69);
    assert.equal(result.revenueNet, 801);
    assert.equal(result.contribution, 391);
    assert.equal(result.contributionPct, 0.391);
  });

  it('extracts VAT from sale price and adds business tax to total tax', () => {
    const result = calculate({
      fulfillmentMode: 'FBO',
      taxSystem: 'ip_usn_income_vat',
      price: 1220,
      taxPct: 6,
      vatPct: 22,
    });

    assert.equal(result.vat, 220);
    assert.equal(result.taxBase, 1000);
    assert.equal(result.businessTax, 60);
    assert.equal(result.tax, 280);
    assert.equal(result.revenueNet, 940);
  });

  it('selects FBO and FBS channel expenses from the active fulfillment mode', () => {
    const fbo = calculate({
      fulfillment_mode: 'FBO',
      price: 1000,
      fbo_wb_logistics: 100,
      fbo_storage: 20,
      fbo_other: 5,
      fbs_last_mile: 999,
      fbs_ops: 999,
      fbs_storage: 999,
      fbs_other: 999,
    });
    const fbs = calculate({
      fulfillment_mode: 'FBS',
      price: 1000,
      fbo_wb_logistics: 999,
      fbo_storage: 999,
      fbo_other: 999,
      fbs_last_mile: 50,
      fbs_ops: 25,
      fbs_storage: 10,
      fbs_other: 5,
    });

    assert.equal(fbo.channelVar, 125);
    assert.equal(fbs.channelVar, 90);
  });

  it('keeps return loss outside varCost in donor default formula', () => {
    const noReturns = calculate({
      fulfillmentMode: 'FBO',
      price: 1000,
      wbCommissionPct: 10,
      returnRatePct: 0,
      returnLoss: 200,
      fixedMonthly: 10000,
    });
    const withReturns = calculate({
      fulfillmentMode: 'FBO',
      price: 1000,
      wbCommissionPct: 10,
      returnRatePct: 50,
      returnLoss: 200,
      fixedMonthly: 10000,
    });

    assert.equal(withReturns.returnLossPerSale, 100);
    assert.equal(withReturns.varCost, noReturns.varCost);
    assert.ok(withReturns.grossProfit < noReturns.grossProfit);
    assert.ok(withReturns.contribution < noReturns.contribution);
    assert.ok(withReturns.bepUnits > noReturns.bepUnits);
  });

  it('matches donor default BEP behavior for non-positive contribution', () => {
    const result = calculate({
      fulfillmentMode: 'FBO',
      price: 100,
      wbCommissionPct: 50,
      cogsPurchase: 100,
      fixedMonthly: 5000,
    });

    assert.ok(result.contribution <= 0);
    assert.equal(result.bepUnits, 50000000);
    assert.equal(result.isProfitable, false);
  });

  it('normalizes negative values and clamps percents like donor service', () => {
    const input = normalizeUnitEconomicsInput({
      fulfillment_mode: 'FBS',
      price: -10,
      wb_commission_pct: 150,
      tax_pct: -1,
      fbs_last_mile: '42.5',
    });

    assert.equal(input.price, 0);
    assert.equal(input.wbCommissionPct, 100);
    assert.equal(input.taxPct, 0);
    assert.equal(input.fbsLastMilePerSale, 42.5);
  });

  it('formats donor ratio percentages while preserving legacy percent inputs', () => {
    assert.equal(formatPct(0.391), '39.1%');
    assert.equal(formatPct(15), '15.0%');
  });
});

describe('calculator view model', () => {
  it('calculates WB report metrics from statement formulas', () => {
    const metrics = calculateWbReportMetrics({
      wb_sales_rub: 10000,
      wb_returns_rub: 1000,
      wb_sales_units: 20,
      wb_cancellations_units: 5,
      wb_commission_rub: 900,
      wb_acquiring_rub: 180,
      wb_logistics_delivery_rub: 700,
      wb_logistics_return_rub: 200,
      wb_payout_rub: 7500,
      wb_cogs_rub: 4000,
      wb_realized_rub: 9500,
      wb_total_net_profit_rub: 7000,
      tax_pct: 6,
    });

    assert.equal(metrics.revenue, 9000);
    assert.equal(metrics.avgSalePrice, 500);
    assert.equal(metrics.buyoutPct, 0.8);
    assert.equal(metrics.commissionPct, 0.1);
    assert.equal(metrics.acquiringPct, 0.02);
    assert.equal(metrics.totalLogistics, 900);
    assert.equal(metrics.logisticsRevenuePct, 0.1);
    assert.equal(metrics.wbDeductions, 1500);
    assert.equal(metrics.taxBase, 9500);
    assert.equal(metrics.taxAmount, 570);
    assert.equal(metrics.netProfit, 2930);
    assert.equal(metrics.profitPerUnit, 146.5);
    assert.equal(metrics.profitSharePct, 2.3891);
    assert.equal(metrics.profitMarginPct, 0.3256);
    assert.equal(metrics.profitabilityPct, 0.7325);
  });

  it('shows a zero BEP when contribution is positive and fixed expenses are absent', () => {
    const form = {
      price: 1000,
      wb_commission_pct: 10,
      tax_pct: 6,
      acquiring_pct: 2,
      cogs_purchase: 300,
    };
    const result = calculate(form);
    const view = buildCalculatorViewModel(form, result);

    assert.equal(result.isProfitable, true);
    assert.equal(result.bepUnits, undefined);
    assert.equal(view.bep.isReachable, true);
    assert.equal(view.bep.units, 0);
    assert.equal(view.bep.display, '0 шт.');
  });

  it('uses persisted snake_case BEP before assuming no fixed expenses', () => {
    const view = buildCalculatorViewModel(
      { fixed_monthly: 10000 },
      {
        contribution: 200,
        is_profitable: true,
        bep_units: 50,
      },
    );

    assert.equal(view.bep.isReachable, true);
    assert.equal(view.bep.units, 50);
    assert.equal(view.bep.display, '50 шт.');
  });

  it('keeps negative monthly profit visible instead of clamping it to zero', () => {
    const form = {
      price: 100,
      wb_commission_pct: 50,
      cogs_purchase: 100,
      fixed_monthly: 1000,
      monthly_plan: 10,
    };
    const result = calculate(form);
    const view = buildCalculatorViewModel(form, result);

    assert.equal(result.contribution, -50);
    assert.equal(view.monthly.units, 10);
    assert.equal(view.monthly.profit, -1500);
  });

  it('builds cost slices from normalized result values including waste', () => {
    const form = {
      price: 1000,
      cogs_purchase: 100,
      cogs_packaging: 50,
      cogs_inbound_to_wb: 50,
      waste_pct: 20,
    };
    const result = calculate(form);
    const view = buildCalculatorViewModel(form, result);

    const cogsSlice = view.costBreakdown.slices.find((slice) => slice.key === 'cogs');
    assert.equal(result.cogsWithWaste, 240);
    assert.equal(cogsSlice.value, 240);
    assert.equal(view.costBreakdown.total, 240);
  });

  it('uses the active fulfillment mode for logistics sensitivity', () => {
    assert.equal(getLogisticsSensitivityField({ fulfillment_mode: 'FBO' }), 'fbo_wb_logistics');
    assert.equal(getLogisticsSensitivityField({ fulfillment_mode: 'FBS' }), 'fbs_last_mile');
  });

  it('persists a zero BEP for profitable calculations without fixed expenses', () => {
    const form = {
      product_id: 'product-1',
      project_id: 'project-1',
      price: 1000,
      wb_commission_pct: 10,
      tax_pct: 6,
      cogs_purchase: 300,
    };
    const result = calculate(form);
    const payload = buildCalculationPayload(form, result, {
      productMap: { 'product-1': { client_id: 'client-from-product' } },
      projectMap: { 'project-1': { client_id: 'client-from-project' } },
    });

    assert.equal(payload.bep_units, 0);
    assert.equal(payload.client_id, 'client-from-project');
    assert.equal(payload.wb_report.revenue, 0);
  });

  it('preserves an existing client id when project and product maps do not resolve it', () => {
    const form = {
      client_id: 'client-from-form',
      product_id: 'product-missing',
      project_id: 'project-missing',
      price: 1000,
      cogs_purchase: 300,
    };
    const result = calculate(form);
    const payload = buildCalculationPayload(form, result);

    assert.equal(payload.client_id, 'client-from-form');
  });

  it('recommends price against contribution margin, not gross margin only', () => {
    const form = {
      price: 1000,
      wb_commission_pct: 10,
      tax_pct: 6,
      cogs_purchase: 300,
      cac: 200,
      paid_share_pct: 100,
    };
    const result = calculate(form);
    const recommendedPrice = calculateRecommendedPrice(form, result, { targetMarginPct: 40 });
    const projected = calculate({ ...form, price: recommendedPrice });

    assert.ok(projected.grossMarginPct >= 0.4);
    assert.ok(projected.contributionPct >= 0.4);
  });
});

describe('calculator parameter documentation', () => {
  it('documents every editable calculator placement', () => {
    for (const placement of CALCULATOR_INPUT_PLACEMENTS) {
      const doc = getCalculatorParameterDoc(placement.field);

      assert.notEqual(doc.role, 'unknown', placement.field);
      assert.ok(doc.tooltip, placement.field);
      assert.ok(doc.label, placement.field);
    }
  });

  it('does not place the same editable parameter in multiple calculator blocks', () => {
    const duplicates = CALCULATOR_INPUT_PLACEMENTS
      .map((placement) => placement.field)
      .filter((field, index, fields) => fields.indexOf(field) !== index);

    assert.deepEqual(duplicates, []);
  });
});

describe('calculator profitability advice', () => {
  it('returns a price action for unit-loss calculations', () => {
    const form = {
      price: 100,
      wb_commission_pct: 20,
      tax_pct: 6,
      cogs_purchase: 120,
      fbo_wb_logistics: 20,
    };
    const result = calculate(form);
    const advice = buildCalculatorAdvice(form, result);
    const priceItem = advice.items.find((item) => item.id === 'price');

    assert.equal(advice.status, 'unit_loss');
    assert.equal(priceItem?.field, 'price');
    assert.equal(priceItem?.canApply, true);
    assert.ok(priceItem.recommendedValue > form.price);
    assert.equal(advice.fieldHints.price.itemId, 'price');
  });

  it('recommends a price that restores positive contribution', () => {
    const form = {
      price: 150,
      wb_commission_pct: 18,
      tax_pct: 6,
      cogs_purchase: 130,
      fbo_wb_logistics: 45,
      cac: 30,
      paid_share_pct: 100,
    };
    const result = calculate(form);
    const advice = buildCalculatorAdvice(form, result);
    const priceItem = advice.items.find((item) => item.id === 'price');
    const projected = calculate({ ...form, price: priceItem.recommendedValue });

    assert.equal(advice.status, 'unit_loss');
    assert.ok(projected.contribution >= 1);
    assert.ok(priceItem.projectedContribution >= 1);
  });

  it('creates field hints for high cost, logistics, and marketing drivers', () => {
    const form = {
      price: 300,
      wb_commission_pct: 10,
      tax_pct: 6,
      cogs_purchase: 220,
      fbo_wb_logistics: 80,
      cac: 50,
      paid_share_pct: 100,
    };
    const result = calculate(form);
    const advice = buildCalculatorAdvice(form, result);

    assert.equal(advice.status, 'unit_loss');
    assert.equal(advice.fieldHints.cogs_purchase.itemId, 'cogs');
    assert.equal(advice.fieldHints.fbo_wb_logistics.itemId, 'logistics');
    assert.equal(advice.fieldHints.cac.itemId, 'marketing');
    assert.equal(advice.fieldHints.paid_share_pct.itemId, 'marketing');
  });

  it('detects monthly loss when unit contribution is positive but plan is below BEP', () => {
    const form = {
      price: 1000,
      wb_commission_pct: 10,
      tax_pct: 6,
      cogs_purchase: 300,
      fixed_monthly: 10000,
      monthly_plan: 5,
    };
    const result = calculate(form);
    const advice = buildCalculatorAdvice(form, result);

    assert.ok(result.contribution > 0);
    assert.equal(advice.status, 'monthly_loss');
    assert.equal(advice.items[0].field, 'monthly_plan');
    assert.equal(advice.fieldHints.monthly_plan.itemId, 'monthly-plan');
  });

  it('does not show critical advice for profitable calculations', () => {
    const form = {
      price: 1000,
      wb_commission_pct: 10,
      tax_pct: 6,
      cogs_purchase: 300,
      fixed_monthly: 1000,
      monthly_plan: 100,
    };
    const result = calculate(form);
    const advice = buildCalculatorAdvice(form, result);

    assert.equal(advice.status, 'profitable');
    assert.deepEqual(advice.items, []);
    assert.deepEqual(advice.fieldHints, {});
  });
});

describe('logistics calculations', () => {
  const matrixDirectories = {
    wildberries: [
      {
        direction_id: 'warehouse-msk',
        direction_name: 'Склад Москва',
        tariffs: {
          FBO: {
            box: { base: 100, per_kg: 2, storage: 10 },
            pallet: { base: 900, per_kg: 1, storage: 120 },
          },
          FBS: {
            box: { base: 70, per_kg: 3, storage: 6 },
            pallet: { base: 700, per_kg: 1.5, storage: 90 },
          },
        },
      },
      {
        direction_id: 'pvz-spb',
        direction_name: 'ПВЗ Санкт-Петербург',
        tariffs: {
          FBO: {
            box: { base: 130, per_kg: 2.5, storage: 12 },
            pallet: { base: 1100, per_kg: 1.2, storage: 140 },
          },
          FBS: {
            box: { base: 95, per_kg: 3.5, storage: 7 },
            pallet: { base: 850, per_kg: 1.7, storage: 100 },
          },
        },
      },
    ],
  };

  it('resolves directory tariffs by fulfillment mode, package mode, and direction', () => {
    const fboBox = getTariffs('warehouse-msk', 'FBO', matrixDirectories, { packageMode: 'box' });
    const fboPallet = getTariffs('warehouse-msk', 'FBO', matrixDirectories, { packageMode: 'pallet' });
    const fbsBox = getTariffs('pvz-spb', 'FBS', matrixDirectories, { packageMode: 'box' });
    const fbsPallet = getTariffs('pvz-spb', 'FBS', matrixDirectories, { packageMode: 'pallet' });

    assert.deepEqual(
      [fboBox.base, fboBox.per_kg, fboBox.storage, fboBox.source, fboBox.packageMode],
      [100, 2, 10, 'wildberries', 'box'],
    );
    assert.deepEqual(
      [fboPallet.base, fboPallet.per_kg, fboPallet.storage, fboPallet.source, fboPallet.packageMode],
      [900, 1, 120, 'wildberries', 'pallet'],
    );
    assert.deepEqual(
      [fbsBox.base, fbsBox.per_kg, fbsBox.storage, fbsBox.source, fbsBox.packageMode],
      [95, 3.5, 7, 'wildberries', 'box'],
    );
    assert.deepEqual(
      [fbsPallet.base, fbsPallet.per_kg, fbsPallet.storage, fbsPallet.source, fbsPallet.packageMode],
      [850, 1.7, 100, 'wildberries', 'pallet'],
    );
  });

  it('allocates pallet tariffs per box and keeps box tariffs per unit for all FBO/FBS direction combinations', () => {
    const product = {
      size_length_cm: 30,
      size_width_cm: 40,
      size_height_cm: 30,
      weight_kg: 3,
      wb_boxes_per_pallet: 10,
    };

    const cases = [
      ['warehouse-msk', 'FBO', 'box', 114.3, 10],
      ['warehouse-msk', 'FBO', 'pallet', 97.2, 12],
      ['warehouse-msk', 'FBS', 'box', 91.45, 6],
      ['warehouse-msk', 'FBS', 'pallet', 80.79, 9],
      ['pvz-spb', 'FBO', 'box', 147.88, 12],
      ['pvz-spb', 'FBO', 'pallet', 118.63, 14],
      ['pvz-spb', 'FBS', 'box', 120.03, 7],
      ['pvz-spb', 'FBS', 'pallet', 97.23, 10],
    ];

    for (const [direction, mode, packageMode, expectedTotal, expectedStorage] of cases) {
      const result = calculateLogisticsCost(
        { ...product, package_mode: packageMode },
        mode,
        direction,
        matrixDirectories,
      );

      assert.equal(result.total, expectedTotal, `${direction} ${mode} ${packageMode} total`);
      assert.equal(result.storage, expectedStorage, `${direction} ${mode} ${packageMode} storage`);
      assert.equal(result.source, 'wildberries');
      assert.equal(result.packageMode, packageMode);
    }
  });

  it('supports WB liter-based tariff fields from the accounting formulas document', () => {
    const directoriesMap = {
      wildberries: [
        {
          direction_id: 'wb-formula',
          direction_name: 'WB formula direction',
          tariffs: {
            FBO: {
              box: {
                boxDeliveryBase: 100,
                boxDeliveryLiter: 5,
                boxStorageBase: 10,
                boxStorageLiter: 1,
              },
              pallet: {
                palletDeliveryValueBase: 900,
                palletDeliveryValueLiter: 20,
                palletStorageValueExpr: 120,
              },
            },
            FBS: {
              box: {
                boxDeliveryMarketplaceBase: 70,
                boxDeliveryMarketplaceLiter: 4,
              },
            },
          },
        },
      ],
    };
    const product = {
      size_length_cm: 30,
      size_width_cm: 40,
      size_height_cm: 10,
      weight_kg: 1,
      wb_boxes_per_pallet: 10,
    };

    const fboBox = calculateLogisticsCost({ ...product, package_mode: 'box' }, 'FBO', 'wb-formula', directoriesMap);
    const fboPallet = calculateLogisticsCost({ ...product, package_mode: 'pallet' }, 'FBO', 'wb-formula', directoriesMap);
    const fbsBox = calculateLogisticsCost({ ...product, package_mode: 'box' }, 'FBS', 'wb-formula', directoriesMap);

    assert.equal(fboBox.volumeLiters, 12);
    assert.equal(fboBox.total, 155);
    assert.equal(fboBox.storage, 21);
    assert.equal(fboPallet.total, 1120);
    assert.equal(fboPallet.storage, 120);
    assert.equal(fbsBox.total, 114);
    assert.equal(fbsBox.storage, 0);
  });

  it('calculates boxes per pallet with rotated base fit and usable stack height', () => {
    const pallet = getPalletDimensions();
    const boxesPerPallet = calculateBoxesPerPallet({
      size_length_cm: 70,
      size_width_cm: 40,
      size_height_cm: 30,
    });

    assert.equal(pallet.length_cm, 120);
    assert.equal(pallet.width_cm, 80);
    assert.equal(pallet.height_cm, 15);
    assert.equal(boxesPerPallet, 15);
  });

  it('returns zero pallet capacity when box dimensions are incomplete', () => {
    assert.equal(calculateBoxesPerPallet({ size_length_cm: 30, size_width_cm: 20 }), 0);
  });

  it('uses volumetric weight and dimensions for logistics and FBS compatibility', () => {
    const directoriesMap = {
      wildberries: [
        {
          direction_id: 'test',
          tariffs: {
            FBS: { base: 100, per_kg: 2, storage: 5 },
          },
        },
      ],
    };
    const product = {
      weight_kg: 1,
      size_length_cm: 50,
      size_width_cm: 50,
      size_height_cm: 50,
    };

    const cost = calculateLogisticsCost(product, 'FBS', 'test', directoriesMap);
    const compatibility = checkFulfillmentCompatibility(product, 'FBS');

    assert.equal(cost.volumeLiters, 125);
    assert.equal(cost.billableWeightKg, 25);
    assert.equal(cost.total, 149.9);
    assert.equal(compatibility.available, false);
    assert.match(compatibility.restrictions[0], /25л/);
  });
});

describe('calculator seed from marketplace snapshots', () => {
  const defaultForm = {
    fulfillment_mode: 'FBO',
    price: 0,
    wb_commission_pct: 15,
    tax_system: 'usn_income',
    tax_pct: 6,
    logistics_direction: 'moscow',
    fbo_wb_logistics: 0,
    fbo_storage: 0,
    fbs_last_mile: 0,
    fbs_storage: 0,
  };

  it('uses latest ProductSnapshot values before Product defaults', () => {
    const seed = buildCalculatorSeed({
      defaultForm,
      product: {
        id: 'product-1',
        category: 'Старая категория',
        price: 1000,
        sale_price: 900,
        size_length_cm: 10,
        weight_kg: 0.3,
      },
      productSnapshots: [
        {
          updatedAt: '2026-05-12T00:00:00.000Z',
          price: 1500,
          data: {
            product: {
              salePrice: 1400,
              price: 1600,
              category: 'Дом',
              sizeLengthCm: 30,
              sizeWidthCm: 20,
              sizeHeightCm: 10,
              weightKg: 0.5,
            },
          },
        },
      ],
    });

    assert.equal(seed.price, 1400);
    assert.equal(seed.wb_cabinet_price, 1600);
    assert.equal(seed.category, 'Дом');
    assert.equal(seed.size_length_cm, 30);
    assert.equal(seed.size_width_cm, 20);
    assert.equal(seed.size_height_cm, 10);
    assert.equal(seed.weight_kg, 0.5);
  });

  it('applies synced WB commission directory by fulfillment model', () => {
    const fbo = buildCalculatorSeed({
      defaultForm: { ...defaultForm, fulfillment_mode: 'FBO' },
      product: { id: 'product-1', category: 'Дом', wb_commission_pct: 20 },
      commissionDirectories: [
        {
          source: 'wildberries',
          category_name: 'Дом',
          commission_pct: 14.5,
          commission_by_model: { kgvpMarketplace: 14.5, kgvpSupplier: 11.5 },
        },
      ],
    });
    const fbs = buildCalculatorSeed({
      defaultForm: { ...defaultForm, fulfillment_mode: 'FBS' },
      product: { id: 'product-1', category: 'Дом', wb_commission_pct: 20, fulfillment_mode: 'FBS' },
      commissionDirectories: [
        {
          source: 'wildberries',
          category_name: 'Дом',
          commission_pct: 14.5,
          commission_by_model: { kgvpMarketplace: 14.5, kgvpSupplier: 11.5 },
        },
      ],
    });

    assert.equal(fbo.wb_commission_pct, 14.5);
    assert.equal(fbs.wb_commission_pct, 11.5);
  });

  it('applies logistics directory tariffs to the active calculation channel', () => {
    const seed = buildCalculatorSeed({
      defaultForm: { ...defaultForm, fulfillment_mode: 'FBS' },
      product: {
        id: 'product-1',
        category: 'Дом',
        fulfillment_mode: 'FBS',
        weight_kg: 1,
        size_length_cm: 50,
        size_width_cm: 50,
        size_height_cm: 50,
      },
      logisticsDirectoriesMap: {
        wildberries: [
          {
            direction_id: 'moscow',
            tariffs: {
              FBS: { base: 100, per_kg: 2, storage: 5 },
            },
          },
        ],
      },
    });

    assert.equal(seed.fbs_last_mile, 149.9);
    assert.equal(seed.fbs_storage, 5);
  });

  it('recomputes commission and logistics when fulfillment mode changes manually', () => {
    const next = applyFulfillmentModeSeed({
      form: {
        ...defaultForm,
        category: 'Дом',
        fulfillment_mode: 'FBO',
        weight_kg: 1,
        size_length_cm: 50,
        size_width_cm: 50,
        size_height_cm: 50,
        logistics_direction: 'moscow',
      },
      product: { id: 'product-1', category: 'Дом', wb_commission_pct: 20 },
      fulfillmentMode: 'FBS',
      commissionDirectories: [
        {
          source: 'wildberries',
          category_name: 'Дом',
          commission_pct: 14.5,
          commission_by_model: { kgvpMarketplace: 14.5, kgvpSupplier: 11.5 },
        },
      ],
      logisticsDirectoriesMap: {
        wildberries: [
          {
            direction_id: 'moscow',
            tariffs: {
              FBS: { base: 90, per_kg: 1.5, storage: 5 },
            },
          },
        ],
      },
    });

    assert.equal(next.fulfillment_mode, 'FBS');
    assert.equal(next.wb_commission_pct, 11.5);
    assert.equal(next.fbs_last_mile, 127.43);
    assert.equal(next.fbs_storage, 5);
  });

  it('recomputes logistics from package-specific directory tariffs when package mode changes', () => {
    const form = {
      ...defaultForm,
      fulfillment_mode: 'FBO',
      package_mode: 'pallet',
      wb_boxes_per_pallet: 10,
      size_length_cm: 30,
      size_width_cm: 40,
      size_height_cm: 30,
      weight_kg: 3,
      logistics_direction: 'warehouse-msk',
    };
    const next = applyFulfillmentModeSeed({
      form,
      fulfillmentMode: 'FBO',
      logisticsDirectoriesMap: {
        wildberries: [
          {
            direction_id: 'warehouse-msk',
            tariffs: {
              FBO: {
                box: { base: 100, per_kg: 2, storage: 10 },
                pallet: { base: 900, per_kg: 1, storage: 120 },
              },
            },
          },
        ],
      },
    });

    assert.equal(next.package_mode, 'pallet');
    assert.equal(next.fbo_wb_logistics, 97.2);
    assert.equal(next.fbo_storage, 12);
  });

  it('falls back to Product commission and defaults when snapshots are empty', () => {
    const seed = buildCalculatorSeed({
      defaultForm,
      product: {
        id: 'product-1',
        price: 1000,
        wb_commission_pct: 19,
      },
    });

    assert.equal(seed.price, 1000);
    assert.equal(seed.wb_commission_pct, 19);
    assert.equal(seed.tax_pct, 6);
  });
});
