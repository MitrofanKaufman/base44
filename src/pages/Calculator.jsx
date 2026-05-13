import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { calculate } from '@/lib/unitEconomics';
import { applyFulfillmentModeSeed, buildCalculatorSeed } from '@/lib/calculatorSeed';
import { loadCalculatorDraft, removeCalculatorDraft, saveCalculatorDraft } from '@/lib/calculatorDraftStorage';
import { buildCalculationPayload } from '@/lib/calculationPayload';
import { FilePlus2, Package, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import AdaptiveDashboardGrid from '@/components/layout/AdaptiveDashboardGrid.jsx';
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
const makeProductVersion = (product, form) => makeVersion(product?.name?.slice(0, 20) || 'Версия 1', form);

const formatDraftSavedAt = (savedAt) => {
  if (!savedAt) return '';
  const date = new Date(savedAt);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
};

export default function Calculator() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [versions,  setVersions]  = useState([makeVersion()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [draftPrompt, setDraftPrompt] = useState(null);
  const [leavePrompt, setLeavePrompt] = useState(null);
  const lastSeedSignature = useRef('');
  const restoredDraftProductId = useRef(null);
  const autoSelectedProductId = useRef('');
  const lastPermanentSaveSignature = useRef('');

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

  const form    = versions[activeIdx]?.form || DEFAULT_FORM;
  const setForm = useCallback((updater) => {
    setVersions(vs => vs.map((v, i) =>
      i === activeIdx ? { ...v, form: typeof updater === 'function' ? updater(v.form) : updater } : v
    ));
  }, [activeIdx]);
  const directoriesMap = useMemo(() => {
    const bySource = {};
    logisticsDirectories.forEach(dir => {
      if (!bySource[dir.source]) bySource[dir.source] = [];
      bySource[dir.source].push(dir);
    });
    return bySource;
  }, [logisticsDirectories]);
  const setField = useCallback((k, val) => setForm(prev => {
    if (k !== 'fulfillment_mode') return { ...prev, [k]: val };
    return applyFulfillmentModeSeed({
      form: { ...prev, fulfillment_mode: val },
      product: selectedProduct,
      fulfillmentMode: val,
      commissionDirectories,
      logisticsDirectoriesMap: directoriesMap,
    });
  }), [setForm, selectedProduct, commissionDirectories, directoriesMap]);

  const result = calculate(form);
  const versionsWithResult = versions.map(v => ({ ...v, result: calculate(v.form) }));
  const productMap = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);
  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);
  const selectedClientId = selectedProduct?.client_id
    || projects.find(p => p.id === selectedProduct?.project_id)?.client_id;
  const selectedProject = projects.find(p => p.id === selectedProduct?.project_id);
  const activeCalculationSignature = useMemo(() => {
    if (!selectedProductId) return '';
    return JSON.stringify({
      productId: selectedProductId,
      activeVersion: versions[activeIdx] || null,
    });
  }, [selectedProductId, versions, activeIdx]);
  const hasUnsavedPermanentCalculation = Boolean(
    selectedProductId
    && activeCalculationSignature
    && activeCalculationSignature !== lastPermanentSaveSignature.current
  );

  const buildActiveCalculationData = useCallback(() => {
    if (!selectedProduct) return null;

    return {
      ...form,
      name: versions[activeIdx]?.name || selectedProduct.name || 'Расчёт',
      product_id: selectedProduct.id,
      project_id: selectedProduct.project_id || selectedProject?.id || projects[0]?.id || '',
      client_id: selectedClientId,
    };
  }, [activeIdx, form, projects, selectedClientId, selectedProduct, selectedProject, versions]);

  const saveCalculationMutation = useMutation({
    /**
     * @param {{ data: Record<string, any>, calculationResult: Record<string, any> }} variables
     */
    mutationFn: ({ data, calculationResult }) => (
      base44.entities.Calculation.create(
        buildCalculationPayload(data, calculationResult, { productMap, projectMap })
      )
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calculations'] });
      toast({
        title: 'Расчёт сохранён',
        description: 'Активная версия добавлена в раздел «Расчёты».',
      });
    },
    onError: () => {
      toast({
        title: 'Расчёт не сохранён',
        description: 'Не удалось сохранить расчёт. Черновик останется во временном хранилище браузера.',
      });
    },
  });

  const saveActiveCalculation = useCallback(async () => {
    const data = buildActiveCalculationData();
    if (!data?.product_id || !data?.project_id) {
      toast({
        title: 'Невозможно сохранить',
        description: 'Выберите товар с проектом перед сохранением расчёта.',
      });
      return false;
    }

    const savedSignature = activeCalculationSignature;
    try {
      await saveCalculationMutation.mutateAsync({ data, calculationResult: result });
      lastPermanentSaveSignature.current = savedSignature;
      return true;
    } catch (_error) {
      return false;
    }
  }, [activeCalculationSignature, buildActiveCalculationData, result, saveCalculationMutation]);

  const persistCurrentDraft = useCallback(() => {
    if (!selectedProductId) return;
    saveCalculatorDraft(selectedProductId, { versions, activeIdx });
  }, [activeIdx, selectedProductId, versions]);

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

  const selectFreshProduct = useCallback((product, { clearDraft = false } = {}) => {
    if (!product) {
      setSelectedProduct(null);
      restoredDraftProductId.current = null;
      lastSeedSignature.current = '';
      lastPermanentSaveSignature.current = '';
      setVersions([makeVersion()]);
      setActiveIdx(0);
      return;
    }

    if (clearDraft) removeCalculatorDraft(product.id);

    const seed = buildSeedForProduct(product);
    setSelectedProduct(product);
    restoredDraftProductId.current = null;
    lastSeedSignature.current = '';
    lastPermanentSaveSignature.current = '';
    setVersions([makeProductVersion(product, seed)]);
    setActiveIdx(0);
  }, [buildSeedForProduct]);

  const restoreDraftProduct = useCallback((product, draft) => {
    const restoredVersions = draft.versions.map((version, index) => ({
      name: version.name || `Версия ${index + 1}`,
      form: { ...DEFAULT_FORM, ...version.form },
    }));

    setSelectedProduct(product);
    restoredDraftProductId.current = product.id;
    lastSeedSignature.current = '';
    lastPermanentSaveSignature.current = '';
    setVersions(restoredVersions);
    setActiveIdx(Math.min(Math.max(draft.activeIdx || 0, 0), restoredVersions.length - 1));
  }, []);

  const openProductWithDraftChoice = useCallback((product) => {
    if (!product) {
      selectFreshProduct(null);
      return;
    }

    if (product.id === selectedProduct?.id) return;

    const draft = loadCalculatorDraft(product.id);
    if (draft) {
      setDraftPrompt({ product, draft });
      return;
    }

    selectFreshProduct(product);
  }, [selectFreshProduct, selectedProduct?.id]);

  const continueAfterLeavePrompt = useCallback((action) => {
    if (!action) return;

    if (action.type === 'product') {
      openProductWithDraftChoice(action.product);
      return;
    }

    if (action.type === 'clear-product') {
      selectFreshProduct(null);
      return;
    }

    if (action.type === 'navigate') {
      navigate(action.to);
    }
  }, [navigate, openProductWithDraftChoice, selectFreshProduct]);

  const requestGuardedAction = useCallback((action) => {
    if (!hasUnsavedPermanentCalculation) {
      continueAfterLeavePrompt(action);
      return;
    }

    persistCurrentDraft();
    setLeavePrompt({ action });
  }, [continueAfterLeavePrompt, hasUnsavedPermanentCalculation, persistCurrentDraft]);

  const handleSelectProduct = useCallback((product) => {
    if (!product) {
      requestGuardedAction({ type: 'clear-product' });
      return;
    }

    if (product.id === selectedProduct?.id) return;
    requestGuardedAction({ type: 'product', product });
  }, [requestGuardedAction, selectedProduct?.id]);

  useEffect(() => {
    if (!urlProductId || products.length === 0 || selectedProduct || autoSelectedProductId.current === urlProductId) return;
    const product = products.find(p => p.id === urlProductId);
    if (!product) return;

    autoSelectedProductId.current = urlProductId;
    handleSelectProduct(product);
  }, [urlProductId, products, selectedProduct, handleSelectProduct]);

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
    if (restoredDraftProductId.current === selectedProduct.id) return;
    setForm(() => buildSeedForProduct(selectedProduct));
  }, [selectedProduct, seedSignature, buildSeedForProduct, setForm]);

  useEffect(() => {
    if (!selectedProductId) return;
    saveCalculatorDraft(selectedProductId, { versions, activeIdx });
  }, [selectedProductId, versions, activeIdx]);

  useEffect(() => {
    if (!hasUnsavedPermanentCalculation) return undefined;

    const handleBeforeUnload = (event) => {
      persistCurrentDraft();
      event.preventDefault();
      event.returnValue = 'Данные сохранены во временном хранилище браузера. Даже без сохранения расчёта вы сможете вернуться к ним позже.';
      return event.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedPermanentCalculation, persistCurrentDraft]);

  useEffect(() => {
    if (!hasUnsavedPermanentCalculation) return undefined;

    const handleDocumentClick = (event) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.altKey
        || event.ctrlKey
        || event.shiftKey
      ) {
        return;
      }

      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || anchor.target && anchor.target !== '_self') return;

      const targetUrl = new URL(anchor.href, window.location.href);
      if (targetUrl.origin !== window.location.origin) return;

      const currentUrl = new URL(window.location.href);
      const targetPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
      const currentPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      if (targetPath === currentPath) return;

      event.preventDefault();
      event.stopPropagation();
      requestGuardedAction({ type: 'navigate', to: targetPath });
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [hasUnsavedPermanentCalculation, requestGuardedAction]);

  const handleRestoreDraft = () => {
    if (!draftPrompt) return;
    restoreDraftProduct(draftPrompt.product, draftPrompt.draft);
    setDraftPrompt(null);
  };

  const handleStartNewCalculation = () => {
    if (!draftPrompt) return;
    selectFreshProduct(draftPrompt.product, { clearDraft: true });
    setDraftPrompt(null);
  };

  const handleSaveAndContinue = async () => {
    if (!leavePrompt) return;
    persistCurrentDraft();
    const action = leavePrompt.action;
    const saved = await saveActiveCalculation();
    if (!saved) return;
    setLeavePrompt(null);
    continueAfterLeavePrompt(action);
  };

  const handleContinueWithoutPermanentSave = () => {
    if (!leavePrompt) return;
    persistCurrentDraft();
    const action = leavePrompt.action;
    setLeavePrompt(null);
    continueAfterLeavePrompt(action);
  };

  const draftSavedAtLabel = formatDraftSavedAt(draftPrompt?.draft?.savedAt);
  const leavePromptIsProductSwitch = leavePrompt?.action?.type === 'product';

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

  const calculatorLayoutItems = useMemo(() => [
    {
      id: 'product-context',
      title: 'Товар и параметры',
      defaultSpan: 2,
      allowedSpans: [1, 2, 3, 'full'],
      children: (
        <div className="grid grid-cols-1 lg:grid-cols-[160px_minmax(0,1fr)_180px] gap-3 lg:h-[160px]">
          <div className="bg-card rounded-[18px] border border-border shadow-warm-sm flex flex-col items-center justify-center overflow-hidden gap-2 p-2 min-h-[150px] lg:min-h-0">
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
                  if (data.product?.id) {
                    setSelectedProduct(prev => prev?.id === data.product.id ? { ...prev, ...data.product } : prev);
                  }
                  if (data.price !== undefined && data.price !== null) setField('price', data.price);
                  if (data.wb_commission_pct !== undefined && data.wb_commission_pct !== null) setField('wb_commission_pct', data.wb_commission_pct);
                }}
              />
            )}
          </div>

          <ProductHeader
            products={products}
            selectedProduct={selectedProduct}
            onSelect={handleSelectProduct}
            form={form}
            setField={setField}
          />

          <DimensionsBox
            l={form.size_length_cm}
            w={form.size_width_cm}
            h={form.size_height_cm}
            weight={form.weight_kg}
            onChange={setField}
            mode={form.package_mode || 'box'}
          />
        </div>
      ),
    },
    {
      id: 'financial-summary',
      title: 'Ключевые KPI',
      defaultSpan: 1,
      allowedSpans: [1, 2, 3, 'full'],
      children: <FinancialSummary result={result} form={form} />,
    },
    {
      id: 'cost-inputs',
      title: 'Параметры расчёта',
      defaultSpan: 'full',
      allowedSpans: [2, 3, 'full'],
      disableCollapse: true,
      children: (
        <CostInputsGrid
          form={form}
          setField={setField}
          selectedProduct={selectedProduct}
          selectedClientId={selectedClientId}
          directoriesMap={directoriesMap}
        />
      ),
    },
    {
      id: 'cost-breakdown',
      title: 'Структура затрат',
      defaultSpan: 1,
      defaultRowSpan: 2,
      children: <CostBreakdownChart form={form} />,
    },
    {
      id: 'profit-structure',
      title: 'Структура прибыли',
      defaultSpan: 2,
      children: <ProfitStructureChart form={form} />,
    },
    {
      id: 'unit-economics',
      title: 'Юнит-экономика',
      defaultSpan: 2,
      children: <UnitEconomicsPanel form={form} result={result} />,
    },
    {
      id: 'interactive-profit',
      title: 'Влияние параметров',
      defaultSpan: 2,
      children: <InteractiveProfitChart form={form} result={result} />,
    },
    {
      id: 'price-history',
      title: 'История цен',
      defaultSpan: 2,
      children: <PriceHistoryChart productId={selectedProduct?.id} selectedProduct={selectedProduct} />,
    },
    {
      id: 'competitor-prices',
      title: 'Цены конкурентов',
      defaultSpan: 'full',
      allowedSpans: [2, 3, 'full'],
      children: <CompetitorPriceBlock form={form} myResult={result} />,
    },
    {
      id: 'sensitivity',
      title: 'Чувствительность',
      defaultSpan: 'full',
      allowedSpans: [2, 3, 'full'],
      children: <SensitivityChart form={form} />,
    },
  ], [
    directoriesMap,
    form,
    handleSelectProduct,
    products,
    result,
    selectedClientId,
    selectedProduct,
    setField,
  ]);

  return (
    <div className="p-3 lg:p-4 max-w-[1600px] mx-auto flex flex-col">

      {/* ── Строка заголовка ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 flex-shrink-0" style={{ marginBottom: '12px' }}>
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold tracking-tight text-foreground leading-tight">Калькулятор юнит-экономики</h1>
          <p className="text-[11px] text-muted-foreground">Расчёт прибыльности товара на Wildberries · FBO / FBS</p>
        </div>
        <div className="min-w-0 bg-card rounded-lg border border-border shadow-warm-sm px-3 py-2 overflow-x-auto">
          <VersionsPanel
            versions={versionsWithResult}
            activeIdx={activeIdx}
            onSelect={setActiveIdx}
            onAdd={addVersion}
            onDuplicate={duplicateVersion}
            onRemove={removeVersion}
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            onClick={saveActiveCalculation}
            disabled={!selectedProductId || saveCalculationMutation.isPending}
            className="rounded-md"
          >
            <Save className="w-4 h-4" />
            {saveCalculationMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <ExportButton form={form} result={result} productName={selectedProduct?.name} versionName={versions[activeIdx]?.name} />
        </div>
      </div>

      <AdaptiveDashboardGrid
        items={calculatorLayoutItems}
        storageKey="base44:calculator:adaptive-layout:v1"
        title="Компоновка калькулятора"
        minColumnWidth={320}
        desktopColumns={3}
      />

      <Dialog open={Boolean(draftPrompt)} onOpenChange={(open) => { if (!open) setDraftPrompt(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Найден черновик расчёта</DialogTitle>
            <DialogDescription>
              Для товара «{draftPrompt?.product?.name || 'Товар'}» есть сохранённые данные калькулятора.
              {draftSavedAtLabel && <span className="block mt-1">Сохранено: {draftSavedAtLabel}</span>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleStartNewCalculation}>
              <FilePlus2 className="w-4 h-4" />
              Новый расчёт
            </Button>
            <Button onClick={handleRestoreDraft}>
              <RotateCcw className="w-4 h-4" />
              Восстановить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(leavePrompt)} onOpenChange={(open) => { if (!open) setLeavePrompt(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{leavePromptIsProductSwitch ? 'Переключить товар?' : 'Покинуть калькулятор?'}</DialogTitle>
            <DialogDescription>
              Можно сохранить активную версию расчёта в раздел «Расчёты». Черновик уже сохранён во временном хранилище браузера:
              даже если продолжить без сохранения, данные не исчезнут, и при повторном открытии этого товара калькулятор предложит их восстановить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="outline" onClick={() => setLeavePrompt(null)} disabled={saveCalculationMutation.isPending}>
              Остаться
            </Button>
            <Button
              variant="outline"
              onClick={handleContinueWithoutPermanentSave}
              disabled={saveCalculationMutation.isPending}
            >
              Продолжить без сохранения
            </Button>
            <Button onClick={handleSaveAndContinue} disabled={saveCalculationMutation.isPending}>
              <Save className="w-4 h-4" />
              {saveCalculationMutation.isPending ? 'Сохранение...' : 'Сохранить и продолжить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
