import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Truck, Megaphone, ShieldCheck, RefreshCw } from 'lucide-react';
import LogisticsDirectionSelector from './LogisticsDirectionSelector';
import PickupPointSelector from './PickupPointSelector';
import { calculateLogisticsCost, clearTariffCache, getTariffs } from '@/lib/LogisticsService';
import { syncLogisticsDirectory } from '@/lib/MarketplaceAPI';

const TAX_SYSTEMS = [
  { value: 'usn_income',         label: 'УСН Доходы',         hint: '% от выручки' },
  { value: 'usn_income_expense', label: 'УСН Доходы−Расходы', hint: '% от прибыли' },
];

const DEFAULT_TAX_PCT = { usn_income: 6, usn_income_expense: 15 };

const NumField = ({ label, value, onChange, suffix = '₽', step = '1' }) => (
  <div className="flex items-center justify-between py-[5px] gap-2 border-b border-border/40 last:border-0">
    <span className="text-[11px] text-muted-foreground leading-tight flex-1 min-w-0 truncate">{label}</span>
    <div className="flex items-center gap-0.5 flex-shrink-0">
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
);

const Section = ({ icon: IconComp, title, color, action = null, children }) => (
  <div className="bg-card rounded-[18px] border border-border shadow-warm-sm p-4 flex flex-col min-w-0 h-fit">
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-1.5 min-w-0">
        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${color}`}>
          <IconComp className="w-3 h-3" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground truncate">{title}</span>
      </div>
      {action}
    </div>
    <div className="space-y-0">{children}</div>
  </div>
);

export default function CostInputsGrid({ form, setField, selectedProduct = null, selectedClientId = null, directoriesMap = null }) {
  const qc = useQueryClient();
  const effectiveDirectoriesMap = directoriesMap || {};
  const isFBS = form.fulfillment_mode === 'FBS';
  const syncMutation = useMutation({
    mutationFn: () => syncLogisticsDirectory('wildberries', { clientId: selectedClientId }),
    onSuccess: () => {
      clearTariffCache();
      qc.invalidateQueries({ queryKey: ['logistics-directories'] });
    },
  });

  const handleDirectionChange = (dirId) => {
    setField('logistics_direction', dirId);
  };

  const handleTariffsLoad = (tariffs, dirId) => {
    // Используем полный расчет логистики если есть товар
    if (selectedProduct && dirId) {
      const logisticsProduct = {
        ...selectedProduct,
        weight_kg: form.weight_kg ?? selectedProduct.weight_kg,
        size_length_cm: form.size_length_cm ?? selectedProduct.size_length_cm,
        size_width_cm: form.size_width_cm ?? selectedProduct.size_width_cm,
        size_height_cm: form.size_height_cm ?? selectedProduct.size_height_cm,
      };
      const costBreakdown = calculateLogisticsCost(logisticsProduct, form.fulfillment_mode, dirId, effectiveDirectoriesMap);
      
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
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 items-start">

      {/* СЕБЕСТОИМОСТЬ */}
      <Section icon={Box} title="Себестоимость" color="bg-orange-100 text-orange-600">
        <NumField label="Закупочная цена"     value={form.cogs_purchase}    onChange={v => setField('cogs_purchase', v)} />
        <NumField label="Упаковка"            value={form.cogs_packaging}   onChange={v => setField('cogs_packaging', v)} />
        <NumField label="Фулфилмент / сборка" value={form.cogs_fulfillment} onChange={v => setField('cogs_fulfillment', v)} />
        <NumField label="Доставка до WB"      value={form.cogs_inbound_to_wb} onChange={v => setField('cogs_inbound_to_wb', v)} />
        <NumField label="Брак"                value={form.waste_pct}        onChange={v => setField('waste_pct', v)} suffix="%" step="0.1" />
        <NumField label="Прочие расходы"      value={isFBS ? form.fbs_other : form.fbo_other} onChange={v => setField(isFBS ? 'fbs_other' : 'fbo_other', v)} />
      </Section>

      {/* ЛОГИСТИКА */}
      <Section
        icon={Truck}
        title="Логистика"
        color="bg-blue-100 text-blue-600"
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
          <LogisticsDirectionSelector
            direction={form.logistics_direction || 'moscow'}
            fulfillmentMode={form.fulfillment_mode}
            onDirectionChange={handleDirectionChange}
            onTariffsLoad={handleTariffsLoad}
            product={selectedProduct}
            directoriesMap={effectiveDirectoriesMap}
          />
          <PickupPointSelector
            selectedPoint={form.pickup_point}
            onPointChange={(pointId, point) => {
              setField('pickup_point', pointId);
              if (point?.directionId) {
                setField('logistics_direction', point.directionId);
                handleTariffsLoad(
                  getTariffs(point.directionId, form.fulfillment_mode, effectiveDirectoriesMap),
                  point.directionId,
                );
              }
            }}
            fulfillmentMode={form.fulfillment_mode}
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
            <NumField label="Последняя миля FBS"    value={form.fbs_last_mile} onChange={v => setField('fbs_last_mile', v)} />
            <NumField label="Операции продавца FBS" value={form.fbs_ops}       onChange={v => setField('fbs_ops', v)} />
            <NumField label="Хранение FBS"          value={form.fbs_storage}   onChange={v => setField('fbs_storage', v)} />
            <NumField label="Прочие переменные FBS" value={form.fbs_other}     onChange={v => setField('fbs_other', v)} />
          </>
        ) : (
          <>
            <NumField label="Логистика WB FBO" value={form.fbo_wb_logistics} onChange={v => setField('fbo_wb_logistics', v)} />
            <NumField label="Хранение FBO"     value={form.fbo_storage}      onChange={v => setField('fbo_storage', v)} />
            <NumField label="Прочее FBO"       value={form.fbo_other}        onChange={v => setField('fbo_other', v)} />
          </>
        )}
      </Section>

      {/* МАРКЕТИНГ */}
      <Section icon={Megaphone} title="Маркетинг" color="bg-purple-100 text-purple-600">
        <NumField label="Доля платного трафика" value={form.paid_share_pct} onChange={v => setField('paid_share_pct', v)} suffix="%" step="0.1" />
        <NumField label="CAC / платный заказ"   value={form.cac}            onChange={v => setField('cac', v)} />
        <NumField label="Промо / акции"         value={form.promo_pct}      onChange={v => setField('promo_pct', v)}      suffix="%" step="0.1" />
        <NumField label="Пост. расходы / мес."  value={form.fixed_monthly}  onChange={v => setField('fixed_monthly', v)} />
      </Section>

      {/* НАЛОГИ И КОМИССИИ */}
      <Section icon={ShieldCheck} title="Налоги и комиссии" color="bg-emerald-100 text-emerald-600">
        {/* Компактный переключатель системы налогообложения */}
        <div className="mb-2 pb-2 border-b border-border/40">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide block mb-1">Система налогообложения</span>
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
        <NumField label="Ставка налога"      value={form.tax_pct}           onChange={v => setField('tax_pct', v)}           suffix="%" step="0.1" />
        <NumField label="Эквайринг"          value={form.acquiring_pct}     onChange={v => setField('acquiring_pct', v)}     suffix="%" step="0.1" />
        <NumField label="Комиссия WB"        value={form.wb_commission_pct} onChange={v => setField('wb_commission_pct', v)} suffix="%" step="0.1" />
        <NumField label="Возвраты"           value={form.return_rate_pct}   onChange={v => setField('return_rate_pct', v)}   suffix="%" step="0.1" />
        <NumField label="Потеря на возврате" value={form.return_loss}       onChange={v => setField('return_loss', v)} />
      </Section>
    </div>
  );
}
