import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { calculate } from '@/lib/unitEconomics';
import { buildCalculatorSeed } from '@/lib/calculatorSeed';
import { Package } from 'lucide-react';
import ProductHeader from '@/components/calculator/ProductHeader.jsx';
import DimensionsBox from '@/components/calculator/DimensionsBox';
import CostInputsGrid from '@/components/calculator/CostInputsGrid';
import MarketplaceDataSync from '@/components/calculator/MarketplaceDataSync';
import FinancialSummary from '@/components/calculator/FinancialSummary';
import UnitEconomicsPanel from '@/components/calculator/UnitEconomicsPanel';
import CostBreakdownChart from '@/components/calculator/CostBreakdownChart';
import VersionsPanel from '@/components/calculator/VersionsPanel';
import ExportButton from '@/components/calculator/ExportButton';
import SensitivityChart from '@/components/calculator/SensitivityChart';
import ProfitStructureChart from '@/components/calculator/ProfitStructureChart.jsx';
import CompetitorPriceBlock from '@/components/calculator/CompetitorPriceBlock';
import InteractiveProfitChart from '@/components/calculator/InteractiveProfitChart';
import PriceHistoryChart from '@/components/calculator/PriceHistoryChart';

const DEFAULT_FORM = {
  fulfillment_mode:    'FBO',
  package_mode:        'box',
  price:               0,
  wb_commission_pct:   15,
  tax_system:          'usn_income',
  tax_pct:             6,
  acquiring_pct:       1.5,
  promo_pct:           0,
  return_rate_pct:     5,
  cogs_purchase:       0,
  cogs_packaging:      0,
  cogs_fulfillment:    0,
  cogs_inbound_to_wb:  0,
  waste_pct:           0,
  fbo_wb_logistics:    0,
  fbo_storage:         0,
  fbo_other:           0,
  fbs_last_mile:       0,
  fbs_ops:             0,
  fbs_storage:         0,
  fbs_other:           0,
  return_loss:         0,
  cac:                 0,
  paid_share_pct:      0,
  fixed_monthly:       0,
  monthly_plan:        0,
  wb_cabinet_price:    0,
  logistics_direction: 'moscow',
};

const makeVersion = (name = 'Версия 1', form = DEFAULT_FORM) => ({ name, form });

export default function Calculator() {
  const [versions,  setVersions]  = useState([makeVersion()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const lastSeedSignature = useRef('');

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: logisticsDirectories = [] } = useQuery({
    queryKey: ['logistics-directories'],
    queryFn: () => base44.entities.LogisticsDirectory.list('-synced_at', 1000),
  });
  const { data: commissionDirectories = [] } = useQuery({
    queryKey: ['commission-directories'],
    queryFn: () => base44.entities.MarketplaceCommissionDirectory.list('-synced_at', 1000),
  });
  const selectedProductId = selectedProduct?.id;
  const { data: productSnapshots = [] } = useQuery({
    queryKey: ['product-snapshots', selectedProductId],
    queryFn: () => base44.entities.ProductSnapshot.filter({ productId: selectedProductId }, '-updatedAt', 20),
    enabled: Boolean(selectedProductId),
  });
  const { data: unitEconomicsSnapshots = [] } = useQuery({
    queryKey: ['unit-economics-snapshots', selectedProductId],
    queryFn: () => base44.entities.UnitEconomicsSnapshot.filter({ itemId: selectedProductId }, '-updatedAt', 20),
    enabled: Boolean(selectedProductId),
  });
  const { data: priceHistory = [] } = useQuery({
    queryKey: ['price-history', selectedProductId],
    queryFn: () => base44.entities.PriceHistory.filter({ product_id: selectedProductId }, '-date', 20),
    enabled: Boolean(selectedProductId),
  });

  const urlProductId = new URLSearchParams(window.location.search).get('product_id');
  useEffect(() => {
    if (urlProductId && products.length > 0 && !selectedProduct) {
      const product = products.find(p => p.id === urlProductId);
      if (product) handleSelectProduct(product);
    }
  }, [urlProductId, products]);

  const form    = versions[activeIdx]?.form || DEFAULT_FORM;
  const setForm = useCallback((updater) => {
    setVersions(vs => vs.map((v, i) =>
      i === activeIdx ? { ...v, form: typeof updater === 'function' ? updater(v.form) : updater } : v
    ));
  }, [activeIdx]);
  const setField = useCallback((k, val) => setForm(prev => ({ ...prev, [k]: val })), [setForm]);

  const result = calculate(form);
  const versionsWithResult = versions.map(v => ({ ...v, result: calculate(v.form) }));
  const directoriesMap = useMemo(() => {
    const bySource = {};
    logisticsDirectories.forEach(dir => {
      if (!bySource[dir.source]) bySource[dir.source] = [];
      bySource[dir.source].push(dir);
    });
    return bySource;
  }, [logisticsDirectories]);
  const selectedClientId = selectedProduct?.client_id
    || projects.find(p => p.id === selectedProduct?.project_id)?.client_id;
  const selectedProject = projects.find(p => p.id === selectedProduct?.project_id);

  const buildSeedForProduct = useCallback((product) => buildCalculatorSeed({
    defaultForm: DEFAULT_FORM,
    product,
    project: projects.find(p => p.id === product?.project_id),
    productSnapshots: product?.id === selectedProductId ? productSnapshots : [],
    unitEconomicsSnapshots: product?.id === selectedProductId ? unitEconomicsSnapshots : [],
    priceHistory: product?.id === selectedProductId ? priceHistory : [],
    commissionDirectories,
    logisticsDirectoriesMap: directoriesMap,
  }), [
    projects,
    productSnapshots,
    unitEconomicsSnapshots,
    priceHistory,
    commissionDirectories,
    directoriesMap,
    selectedProductId,
  ]);

  const handleSelectProduct = (product) => {
    if (!product) { setSelectedProduct(null); setForm(DEFAULT_FORM); return; }
    setSelectedProduct(product);
    lastSeedSignature.current = '';
    setForm(() => buildSeedForProduct(product));
    setVersions(vs => vs.map((v, i) =>
      i === activeIdx ? { ...v, name: product.name.slice(0, 20) } : v
    ));
  };

  const seedSignature = useMemo(() => {
    if (!selectedProduct) return '';
    const latestStamp = (items) => items[0]?.updatedAt || items[0]?.updated_at || items[0]?.date || items[0]?.created_date || '';
    return [
      selectedProduct.id,
      selectedProduct.updated_date,
      selectedProject?.updated_date,
      latestStamp(productSnapshots),
      latestStamp(unitEconomicsSnapshots),
      latestStamp(priceHistory),
      latestStamp(commissionDirectories),
      latestStamp(logisticsDirectories),
    ].join('|');
  }, [
    selectedProduct,
    selectedProject,
    productSnapshots,
    unitEconomicsSnapshots,
    priceHistory,
    commissionDirectories,
    logisticsDirectories,
  ]);

  useEffect(() => {
    if (!selectedProduct || !seedSignature || lastSeedSignature.current === seedSignature) return;
    lastSeedSignature.current = seedSignature;
    setForm(() => buildSeedForProduct(selectedProduct));
  }, [selectedProduct, seedSignature, buildSeedForProduct, setForm]);

  const addVersion = () => {
    const newIdx = versions.length;
    setVersions(vs => [...vs, makeVersion(`Версия ${vs.length + 1}`, { ...form })]);
    setActiveIdx(newIdx);
  };

  const duplicateVersion = () => {
    const newIdx = versions.length;
    setVersions(vs => [...vs, { ...vs[activeIdx], name: `${vs[activeIdx].name} (копия)`, form: { ...vs[activeIdx].form } }]);
    setActiveIdx(newIdx);
  };

  const removeVersion = (idx) => {
    setVersions(vs => vs.filter((_, i) => i !== idx));
    setActiveIdx(prev => Math.max(0, prev >= idx ? prev - 1 : prev));
  };

  return (
    <div className="p-3 lg:p-4 max-w-[1600px] mx-auto flex flex-col">

      {/* ── Строка заголовка ── */}
      <div className="flex items-center gap-3 flex-wrap flex-shrink-0" style={{ marginBottom: '12px' }}>
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-foreground leading-tight">Калькулятор юнит-экономики</h1>
          <p className="text-[11px] text-muted-foreground">Расчёт прибыльности товара на Wildberries · FBO / FBS</p>
        </div>
        <div className="flex-1 min-w-0 bg-card rounded-lg border border-border shadow-warm-sm px-3 py-2 overflow-x-auto">
          <VersionsPanel
            versions={versionsWithResult}
            activeIdx={activeIdx}
            onSelect={setActiveIdx}
            onAdd={addVersion}
            onDuplicate={duplicateVersion}
            onRemove={removeVersion}
          />
        </div>
        <ExportButton form={form} result={result} productName={selectedProduct?.name} versionName={versions[activeIdx]?.name} />
      </div>

      {/* ── Ряд 1: Фото | Параметры товара | Габариты ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px minmax(0,1fr) 180px', gap: '12px', height: '160px', marginBottom: '12px', flexShrink: 0 }}>

        {/* Фото товара */}
        <div className="bg-card rounded-[18px] border border-border shadow-warm-sm flex flex-col items-center justify-center overflow-hidden gap-2 p-2">
          {selectedProduct?.image_url ? (
            <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-[100px] object-contain" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5">
              <Package className="w-7 h-7 text-muted-foreground/20" />
              <span className="text-[9px] text-muted-foreground/30">Фото</span>
            </div>
          )}
          {selectedProduct?.id && (
            <MarketplaceDataSync
              productId={selectedProduct.id}
              selectedProduct={selectedProduct}
              onDataUpdate={(data) => {
                if (data.price !== undefined && data.price !== null) setField('price', data.price);
                if (data.wb_commission_pct !== undefined && data.wb_commission_pct !== null) setField('wb_commission_pct', data.wb_commission_pct);
              }}
            />
          )}
        </div>

        {/* Параметры товара */}
        <ProductHeader
          products={products}
          selectedProduct={selectedProduct}
          onSelect={handleSelectProduct}
          form={form}
          setField={setField}
        />

        {/* Габариты */}
        <DimensionsBox
          l={form.size_length_cm}
          w={form.size_width_cm}
          h={form.size_height_cm}
          weight={form.weight_kg}
          onChange={setField}
          mode={form.package_mode || 'box'}
        />
      </div>

      {/* ── Ряд 2: 4 колонки параметров ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
        <CostInputsGrid 
          form={form} 
          setField={setField}
          selectedProduct={selectedProduct}
          selectedClientId={selectedClientId}
          directoriesMap={directoriesMap}
        />
      </div>

      {/* ── Ряд 3: Финансы и виджеты юнит-экономики ── */}
      <div className="grid grid-cols-1 gap-3 items-start" style={{ marginBottom: '12px' }}>
        <FinancialSummary result={result} form={form} />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
        <CostBreakdownChart form={form} />
        <ProfitStructureChart form={form} />
        <UnitEconomicsPanel form={form} result={result} />
        </div>
      </div>

      {/* ── Ряд 3.5: Интерактивный график влияния ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start" style={{ marginBottom: '12px' }}>
        <InteractiveProfitChart form={form} result={result} />
      </div>

      {/* ── Ряд 4: История цен и маржи ── */}
      <div style={{ marginBottom: '12px' }}>
        <PriceHistoryChart productId={selectedProduct?.id} selectedProduct={selectedProduct} />
      </div>

      {/* ── Ряд 5: Анализ цен конкурентов ── */}
      <div style={{ marginBottom: '12px' }}>
        <CompetitorPriceBlock form={form} myResult={result} />
      </div>

      {/* ── Ряд 6: График чувствительности на всю ширину ── */}
      <SensitivityChart form={form} />

    </div>
  );
}
