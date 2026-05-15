import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Box, ChevronDown, Megaphone, Minus, ReceiptText, RefreshCw, ShieldCheck, Truck } from 'lucide-react';
import LogisticsSelector from './LogisticsSelector';
import { calculateLogisticsCost, clearTariffCache } from '@/lib/LogisticsService';
import { syncLogisticsDirectory, syncWbCommissionDirectory } from '@/lib/MarketplaceAPI';
import { cn } from '@/lib/utils';
import { MASONRY_ROW_HEIGHT, useMasonryGrid } from '@/lib/useMasonryGrid';
import CalculatorParameterTooltip from './CalculatorParameterTooltip';

const TAX_SYSTEMS = [
  { value: 'usn_income',         label: 'УСН Доходы',         hint: '% от выручки' },
  { value: 'usn_income_expense', label: 'УСН Доходы−Расходы', hint: '% от прибыли' },
];

const DEFAULT_TAX_PCT = { usn_income: 6, usn_income_expense: 15 };
const COLLAPSED_STORAGE_KEY = 'base44:calculator:cost-input-sections:v1';
const SECTION_IDS = ['costs', 'logistics', 'marketing', 'taxes', 'wb-report'];

/**
 * @returns {Record<string, boolean>}
 */
function readCollapsedSections() {
  if (typeof window === 'undefined') return {};

  try {
    const parsed = JSON.parse(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) || '{}');
    return SECTION_IDS.reduce((acc, id) => {
      acc[id] = Boolean(parsed[id]);
      return acc;
    }, /** @type {Record<string, boolean>} */ ({}));
  } catch (_error) {
    return {};
  }
}

const FieldLabel = ({ field, children, className = '' }) => (
  <span className={cn('inline-flex items-center gap-0.5 min-w-0', className)}>
    <span className="truncate">{children}</span>
    <CalculatorParameterTooltip field={field} />
  </span>
);

const NumField = ({ field, label, value, onChange, suffix = '₽', step = '1', hint = null }) => (
  <div className={cn(
    'py-[5px] border-b last:border-0',
    hint ? 'border-destructive/30' : 'border-border/40',
  )}>
    <div className="flex items-center justify-between gap-2">
      <FieldLabel field={field} className={cn(
        'text-[11px] leading-tight flex-1 min-w-0 truncate',
        hint ? 'text-destructive font-semibold' : 'text-muted-foreground',
      )}>{label}</FieldLabel>
      <div className={cn(
        'flex items-center gap-0.5 flex-shrink-0 rounded px-0.5',
        hint && 'bg-destructive/5 ring-1 ring-destructive/30',
      )}>
        <input
          type="number"
          step={step}
          min="0"
          value={value ?? ''}
          onChange={e => onChange(+e.target.value)}
          className="w-14 h-5 bg-transparent text-[11px] font-bold text-right focus:outline-none focus:bg-secondary/30 rounded px-0.5"
          placeholder="0"
        />
        <span className="text-[10px] text-muted-foreground font-semibold w-5 text-left">{suffix}</span>
      </div>
    </div>
    {hint && (
      <div className="flex items-start gap-1 pt-1 text-[9px] leading-tight text-destructive">
        <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 mt-px" />
        <span>{hint.title}</span>
      </div>
    )}
  </div>
);

const Section = ({
  id,
  icon: IconComp,
  title,
  color,
  action = null,
  collapsed,
  onToggle,
  className,
  masonryRowSpan,
  registerMasonryItem,
  children,
}) => {
  const setSectionRef = useCallback((node) => {
    registerMasonryItem(id, node);
  }, [id, registerMasonryItem]);

  return (
    <section
      ref={setSectionRef}
      className={cn('bg-card rounded-[18px] border border-border shadow-warm-sm p-4 flex flex-col min-w-0 h-fit', className)}
      style={masonryRowSpan ? { gridRowEnd: `span ${masonryRowSpan}` } : undefined}
    >
      <div className={cn('flex items-center justify-between gap-2', !collapsed && 'mb-3')}>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${color}`}>
            <IconComp className="w-3 h-3" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {action}
          <button
            type="button"
            onClick={() => onToggle(id)}
            title={collapsed ? `Развернуть блок «${title}»` : `Свернуть блок «${title}»`}
            aria-label={collapsed ? `Развернуть блок ${title}` : `Свернуть блок ${title}`}
            className="w-7 h-7 rounded-md border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {!collapsed && <div className="space-y-0">{children}</div>}
    </section>
  );
};

export default function CostInputsGrid({ form, setField, selectedProduct = null, selectedClientId = null, directoriesMap = null, fieldHints = {} }) {
  const qc = useQueryClient();
  const [collapsedSections, setCollapsedSections] = useState(readCollapsedSections);
  const { rowSpans, registerItem } = /** @type {{ rowSpans: Record<string, number>, registerItem: (id: string, node: HTMLElement | null) => void }} */ (
    useMasonryGrid({ itemIds: SECTION_IDS })
  );
  const safeFieldHints = /** @type {Record<string, any>} */ (fieldHints);
  const effectiveDirectoriesMap = directoriesMap || {};
  const isFBS = form.fulfillment_mode === 'FBS';
  const syncMutation = useMutation({
    mutationFn: () => syncLogisticsDirectory('wildberries', { clientId: selectedClientId }),
    onSuccess: () => {
      clearTariffCache();
      qc.invalidateQueries({ queryKey: ['logistics-directories'] });
    },
  });
  const commissionSyncMutation = useMutation({
    mutationFn: () => syncWbCommissionDirectory(selectedClientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-directories'] });
    },
  });

  const handleDirectionChange = (dirId) => {
    setField('logistics_direction', dirId);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(collapsedSections));
    } catch (_error) {
      // Состояние сворачивания не должно мешать работе калькулятора.
    }
  }, [collapsedSections]);

  const toggleSection = useCallback((id) => {
    setCollapsedSections(current => ({
      ...current,
      [id]: !current[id],
    }));
  }, []);

  const handleTariffsLoad = (tariffs, dirId) => {
    if (dirId) {
      const logisticsProduct = { ...(selectedProduct || {}), ...form };
      const costBreakdown = calculateLogisticsCost(
        logisticsProduct,
        form.fulfillment_mode,
        dirId,
        effectiveDirectoriesMap,
      );

      if (isFBS) {
        setField('fbs_last_mile', costBreakdown.total);
        setField('fbs_storage', costBreakdown.storage);
      } else {
        setField('fbo_wb_logistics', costBreakdown.total);
        setField('fbo_storage', costBreakdown.storage);
      }
    } else {
      // Fallback на базовый тариф
      if (isFBS) {
        setField('fbs_last_mile', tariffs.base);
        setField('fbs_storage', tariffs.storage);
      } else {
        setField('fbo_wb_logistics', tariffs.base);
        setField('fbo_storage', tariffs.storage);
      }
    }
  };

  // Автоматически обновляем комиссию WB при смене товара
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start"
      style={{ gridAutoRows: `${MASONRY_ROW_HEIGHT}px` }}
    >

      {/* СЕБЕСТОИМОСТЬ */}
      <Section
        id="costs"
        icon={Box}
        title="Себестоимость"
        color="bg-orange-100 text-orange-600"
        collapsed={collapsedSections.costs}
        onToggle={toggleSection}
        className="xl:col-span-2"
        masonryRowSpan={rowSpans.costs}
        registerMasonryItem={registerItem}
      >
        <NumField field="cogs_purchase" label="Закупочная цена" value={form.cogs_purchase} onChange={v => setField('cogs_purchase', v)} hint={safeFieldHints.cogs_purchase} />
        <NumField field="cogs_packaging" label="Упаковка" value={form.cogs_packaging} onChange={v => setField('cogs_packaging', v)} hint={safeFieldHints.cogs_packaging} />
        <NumField field="cogs_fulfillment" label="Фулфилмент / сборка" value={form.cogs_fulfillment} onChange={v => setField('cogs_fulfillment', v)} hint={safeFieldHints.cogs_fulfillment} />
        <NumField field="cogs_inbound_to_wb" label="Доставка до WB" value={form.cogs_inbound_to_wb} onChange={v => setField('cogs_inbound_to_wb', v)} hint={safeFieldHints.cogs_inbound_to_wb} />
        <NumField field="waste_pct" label="Брак" value={form.waste_pct} onChange={v => setField('waste_pct', v)} suffix="%" step="0.1" hint={safeFieldHints.waste_pct} />
      </Section>

      {/* ЛОГИСТИКА */}
      <Section
        id="logistics"
        icon={Truck}
        title="Логистика"
        color="bg-blue-100 text-blue-600"
        collapsed={collapsedSections.logistics}
        onToggle={toggleSection}
        className=""
        masonryRowSpan={rowSpans.logistics}
        registerMasonryItem={registerItem}
        action={(
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={!selectedClientId || syncMutation.isPending}
            title={selectedClientId ? 'Синхронизировать ПВЗ WB' : 'Выберите товар клиента с WB token'}
            className="w-7 h-7 rounded-md border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
        )}
      >
        <div className="mb-2 pb-2 border-b border-border/40 space-y-2">
          <LogisticsSelector
            direction={form.logistics_direction || 'moscow'}
            pickupPoint={form.pickup_point}
            fulfillmentMode={form.fulfillment_mode}
            onDirectionChange={handleDirectionChange}
            onTariffsLoad={handleTariffsLoad}
            onPointChange={(pointId, _point) => {
              setField('pickup_point', pointId);
            }}
            product={{ ...(selectedProduct || {}), ...form }}
            packageMode={form.package_mode || 'box'}
            directoriesMap={effectiveDirectoriesMap}
          />
          {syncMutation.isError && (
            <div className="text-[10px] text-destructive leading-tight">
              {syncMutation.error?.message || 'Ошибка синхронизации ПВЗ WB'}
            </div>
          )}
        </div>
        {isFBS ? (
          <>
            <NumField field="fbs_last_mile" label="Последняя миля FBS" value={form.fbs_last_mile} onChange={v => setField('fbs_last_mile', v)} hint={safeFieldHints.fbs_last_mile} />
            <NumField field="fbs_ops" label="Операции продавца FBS" value={form.fbs_ops} onChange={v => setField('fbs_ops', v)} hint={safeFieldHints.fbs_ops} />
            <NumField field="fbs_storage" label="Хранение FBS" value={form.fbs_storage} onChange={v => setField('fbs_storage', v)} hint={safeFieldHints.fbs_storage} />
            <NumField field="fbs_other" label="Прочие переменные FBS" value={form.fbs_other} onChange={v => setField('fbs_other', v)} hint={safeFieldHints.fbs_other} />
          </>
        ) : (
          <>
            <NumField field="fbo_wb_logistics" label="Логистика WB FBO" value={form.fbo_wb_logistics} onChange={v => setField('fbo_wb_logistics', v)} hint={safeFieldHints.fbo_wb_logistics} />
            <NumField field="fbo_storage" label="Хранение FBO" value={form.fbo_storage} onChange={v => setField('fbo_storage', v)} hint={safeFieldHints.fbo_storage} />
            <NumField field="fbo_other" label="Прочее FBO" value={form.fbo_other} onChange={v => setField('fbo_other', v)} hint={safeFieldHints.fbo_other} />
          </>
        )}
      </Section>

      {/* МАРКЕТИНГ */}
      <Section
        id="marketing"
        icon={Megaphone}
        title="Маркетинг"
        color="bg-purple-100 text-purple-600"
        collapsed={collapsedSections.marketing}
        onToggle={toggleSection}
        className=""
        masonryRowSpan={rowSpans.marketing}
        registerMasonryItem={registerItem}
      >
        <NumField field="paid_share_pct" label="Доля платного трафика" value={form.paid_share_pct} onChange={v => setField('paid_share_pct', v)} suffix="%" step="0.1" hint={safeFieldHints.paid_share_pct} />
        <NumField field="cac" label="CAC / платный заказ" value={form.cac} onChange={v => setField('cac', v)} hint={safeFieldHints.cac} />
        <NumField field="promo_pct" label="Промо / акции" value={form.promo_pct} onChange={v => setField('promo_pct', v)} suffix="%" step="0.1" hint={safeFieldHints.promo_pct} />
        <NumField field="fixed_monthly" label="Пост. расходы / мес." value={form.fixed_monthly} onChange={v => setField('fixed_monthly', v)} hint={safeFieldHints.fixed_monthly} />
      </Section>

      {/* НАЛОГИ И КОМИССИИ */}
      <Section
        id="taxes"
        icon={ShieldCheck}
        title="Налоги и комиссии"
        color="bg-emerald-100 text-emerald-600"
        collapsed={collapsedSections.taxes}
        onToggle={toggleSection}
        className="xl:col-span-2"
        masonryRowSpan={rowSpans.taxes}
        registerMasonryItem={registerItem}
        action={(
          <button
            type="button"
            onClick={() => commissionSyncMutation.mutate()}
            disabled={!selectedClientId || commissionSyncMutation.isPending}
            title={selectedClientId ? 'Синхронизировать комиссии WB' : 'Выберите товар клиента с WB token'}
            className="w-7 h-7 rounded-md border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${commissionSyncMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
        )}
      >
        {/* Компактный переключатель системы налогообложения */}
        <div className="mb-2 pb-2 border-b border-border/40">
          <FieldLabel field="tax_system" className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">
            Система налогообложения
          </FieldLabel>
          <div className="flex gap-1.5">
            {TAX_SYSTEMS.map(ts => (
              <button
                key={ts.value}
                onClick={() => {
                  setField('tax_system', ts.value);
                  setField('tax_pct', DEFAULT_TAX_PCT[ts.value]);
                }}
                className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-left transition-all min-w-0 ${
                  (form.tax_system || 'usn_income') === ts.value
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-secondary/30 border-transparent hover:border-border'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${
                  (form.tax_system || 'usn_income') === ts.value
                    ? 'border-emerald-600 bg-emerald-600'
                    : 'border-muted-foreground'
                }`} />
                <div className="min-w-0">
                  <p className={`text-[10px] font-bold leading-tight truncate ${
                    (form.tax_system || 'usn_income') === ts.value ? 'text-emerald-800' : 'text-muted-foreground'
                  }`}>{ts.label}</p>
                  <p className="text-[9px] opacity-60 leading-tight truncate">{ts.hint}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <NumField field="tax_pct" label="Ставка налога" value={form.tax_pct} onChange={v => setField('tax_pct', v)} suffix="%" step="0.1" hint={safeFieldHints.tax_pct} />
        <NumField field="acquiring_pct" label="Эквайринг" value={form.acquiring_pct} onChange={v => setField('acquiring_pct', v)} suffix="%" step="0.1" hint={safeFieldHints.acquiring_pct} />
        <NumField field="wb_commission_pct" label="Комиссия WB" value={form.wb_commission_pct} onChange={v => setField('wb_commission_pct', v)} suffix="%" step="0.1" hint={safeFieldHints.wb_commission_pct} />
        <NumField field="return_rate_pct" label="Возвраты" value={form.return_rate_pct} onChange={v => setField('return_rate_pct', v)} suffix="%" step="0.1" hint={safeFieldHints.return_rate_pct} />
        <NumField field="return_loss" label="Потеря на возврате" value={form.return_loss} onChange={v => setField('return_loss', v)} hint={safeFieldHints.return_loss} />
        {commissionSyncMutation.isError && (
          <div className="text-[10px] text-destructive leading-tight pt-2">
            {commissionSyncMutation.error?.message || 'Ошибка синхронизации комиссий WB'}
          </div>
        )}
      </Section>

      {/* WB ОТЧЁТ */}
      <Section
        id="wb-report"
        icon={ReceiptText}
        title="WB отчёт"
        color="bg-sky-100 text-sky-600"
        collapsed={collapsedSections['wb-report']}
        onToggle={toggleSection}
        className="xl:col-span-3"
        masonryRowSpan={rowSpans['wb-report']}
        registerMasonryItem={registerItem}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4">
          <NumField field="wb_sales_rub" label="Продажи" value={form.wb_sales_rub} onChange={v => setField('wb_sales_rub', v)} />
          <NumField field="wb_returns_rub" label="Возврат" value={form.wb_returns_rub} onChange={v => setField('wb_returns_rub', v)} />
          <NumField field="wb_sales_units" label="Итого продаж шт." value={form.wb_sales_units} onChange={v => setField('wb_sales_units', v)} suffix="шт." />
          <NumField field="wb_cancellations_units" label="Отмены и невыкупы" value={form.wb_cancellations_units} onChange={v => setField('wb_cancellations_units', v)} suffix="шт." />
          <NumField field="wb_commission_rub" label="Комиссия руб" value={form.wb_commission_rub} onChange={v => setField('wb_commission_rub', v)} />
          <NumField field="wb_acquiring_rub" label="Эквайринг руб" value={form.wb_acquiring_rub} onChange={v => setField('wb_acquiring_rub', v)} />
          <NumField field="wb_logistics_delivery_rub" label="Логистика доставок" value={form.wb_logistics_delivery_rub} onChange={v => setField('wb_logistics_delivery_rub', v)} />
          <NumField field="wb_logistics_return_rub" label="Логистика возвратов" value={form.wb_logistics_return_rub} onChange={v => setField('wb_logistics_return_rub', v)} />
          <NumField field="wb_payout_rub" label="Оплата на Р/С" value={form.wb_payout_rub} onChange={v => setField('wb_payout_rub', v)} />
          <NumField field="wb_cogs_rub" label="Себестоимость" value={form.wb_cogs_rub} onChange={v => setField('wb_cogs_rub', v)} />
          <NumField field="wb_realized_rub" label="WB реализовал" value={form.wb_realized_rub} onChange={v => setField('wb_realized_rub', v)} />
          <NumField field="wb_total_net_profit_rub" label="Чистая прибыль всего" value={form.wb_total_net_profit_rub} onChange={v => setField('wb_total_net_profit_rub', v)} />
        </div>
      </Section>
    </div>
  );
}
