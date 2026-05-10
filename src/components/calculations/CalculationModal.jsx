import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculate, formatRub, formatPct } from '@/lib/unitEconomics';

const Field = ({ label, value, onChange, type = 'number', hint, step = '0.01' }) => (
  <div className="space-y-1">
    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
    {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    <Input
      className="h-8 text-sm rounded-md"
      type={type}
      step={step}
      value={value ?? ''}
      onChange={e => onChange(type === 'number' ? +e.target.value : e.target.value)}
    />
  </div>
);

const ResultRow = ({ label, value, bold, highlight }) => (
  <div className={`flex items-center justify-between py-1.5 border-b border-border last:border-0 ${bold ? 'font-semibold' : ''}`}>
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-sm font-mono ${highlight === 'pos' ? 'text-success' : highlight === 'neg' ? 'text-destructive' : ''}`}>
      {value}
    </span>
  </div>
);

const SectionTitle = ({ children }) => (
  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3 mt-1">{children}</h3>
);

export default function CalculationModal({ calculation, products, projects, clients: _clients, preProductId, onClose }) {
  const qc     = useQueryClient();
  const isEdit = !!calculation;

  const productMap = Object.fromEntries(products.map(p => [p.id, p]));
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const initProductId = calculation?.product_id || preProductId || products[0]?.id || '';
  const initProduct   = productMap[initProductId];

  const [form, setForm] = useState({
    name:               calculation?.name               || '',
    product_id:         initProductId,
    project_id:         calculation?.project_id         || initProduct?.project_id || projects[0]?.id || '',
    fulfillment_mode:   calculation?.fulfillment_mode   || initProduct?.fulfillment_mode || 'FBO',
    price:              calculation?.price_net           ?? initProduct?.sale_price ?? initProduct?.price ?? 0,
    wb_commission_pct:  calculation?.wb_commission_pct  ?? initProduct?.wb_commission_pct ?? 15,
    tax_pct:            calculation?.tax_pct            ?? 7,
    acquiring_pct:      calculation?.acquiring_pct      ?? 1.5,
    promo_pct:          calculation?.promo_pct          ?? 0,
    return_rate_pct:    calculation?.return_rate_pct    ?? 5,
    cogs_purchase:      calculation?.cogs_purchase      ?? 0,
    cogs_packaging:     calculation?.cogs_packaging     ?? 0,
    cogs_fulfillment:   calculation?.cogs_fulfillment   ?? 0,
    cogs_inbound_to_wb: calculation?.cogs_inbound_to_wb ?? 0,
    waste_pct:          calculation?.waste_pct          ?? 0,
    fbo_wb_logistics:   calculation?.fbo_wb_logistics   ?? 0,
    fbo_storage:        calculation?.fbo_storage        ?? 0,
    fbo_other:          calculation?.fbo_other          ?? 0,
    fbs_last_mile:      calculation?.fbs_last_mile      ?? 0,
    fbs_ops:            calculation?.fbs_ops            ?? 0,
    fbs_storage:        calculation?.fbs_storage        ?? 0,
    fbs_other:          calculation?.fbs_other          ?? 0,
    return_loss:        calculation?.return_loss        ?? 0,
    cac:                calculation?.cac                ?? 0,
    paid_share_pct:     calculation?.paid_share_pct     ?? 0,
    fixed_monthly:      calculation?.fixed_monthly      ?? projectMap[calculation?.project_id]?.fixed_monthly ?? 0,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const onProductChange = (productId) => {
    const prod = productMap[productId];
    if (!prod) return;
    setForm(f => ({
      ...f,
      product_id:        productId,
      project_id:        prod.project_id || f.project_id,
      fulfillment_mode:  prod.fulfillment_mode || f.fulfillment_mode,
      price:             prod.sale_price || prod.price || f.price,
      wb_commission_pct: prod.wb_commission_pct || f.wb_commission_pct,
    }));
  };

  const result = calculate(form);

  const mut = useMutation({
    mutationFn: (data) => {
      const prod = productMap[data.product_id];
      const proj = projectMap[data.project_id];
      const payload = {
        ...data,
        client_id:        proj?.client_id || prod?.client_id,
        price_net:        result.priceNet,
        revenue_net:      result.revenueNet,
        cogs_base:        result.cogsBase,
        cogs_with_waste:  result.cogsWithWaste,
        var_cost:         result.varCost,
        gross_profit:     result.grossProfit,
        gross_margin_pct: result.grossMarginPct,
        marketing_cost:   result.marketingCost,
        contribution:     result.contribution,
        contribution_pct: result.contributionPct,
        bep_units:        result.bepUnits,
        is_profitable:    result.isProfitable,
      };
      return isEdit
        ? base44.entities.Calculation.update(calculation.id, payload)
        : base44.entities.Calculation.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calculations'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-card rounded-lg border border-border w-full max-w-4xl shadow-warm-lg max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-[15px]">{isEdit ? 'Редактировать расчёт' : 'Новый расчёт юнит-экономики'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

            {/* ── Left: Inputs ── */}
            <div className="p-6 space-y-5 border-r border-border">
              {/* Base */}
              <div className="space-y-3">
                <div>
                  <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Название расчёта</Label>
                  <Input
                    className="mt-1.5 h-8 text-sm rounded-md"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="Версия 1 / Базовый сценарий"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Товар</Label>
                    <Select value={form.product_id} onValueChange={onProductChange}>
                      <SelectTrigger className="mt-1.5 h-8 text-sm rounded-md"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Схема</Label>
                    <Select value={form.fulfillment_mode} onValueChange={v => set('fulfillment_mode', v)}>
                      <SelectTrigger className="mt-1.5 h-8 text-sm rounded-md"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FBO">FBO</SelectItem>
                        <SelectItem value="FBS">FBS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Цена */}
              <section>
                <SectionTitle>Цена и удержания</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Цена продажи (₽)"  value={form.price}             onChange={v => set('price', v)} />
                  <Field label="Комиссия WB (%)"    value={form.wb_commission_pct} onChange={v => set('wb_commission_pct', v)} />
                  <Field label="Налог (%)"           value={form.tax_pct}           onChange={v => set('tax_pct', v)} />
                  <Field label="Эквайринг (%)"       value={form.acquiring_pct}     onChange={v => set('acquiring_pct', v)} />
                  <Field label="Промо (%)"            value={form.promo_pct}         onChange={v => set('promo_pct', v)} />
                  <Field label="Возвраты (%)"         value={form.return_rate_pct}   onChange={v => set('return_rate_pct', v)} />
                </div>
              </section>

              {/* Себестоимость */}
              <section>
                <SectionTitle>Себестоимость</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Закупка (₽)"        value={form.cogs_purchase}      onChange={v => set('cogs_purchase', v)} />
                  <Field label="Упаковка (₽)"        value={form.cogs_packaging}     onChange={v => set('cogs_packaging', v)} />
                  <Field label="Сборка (₽)"          value={form.cogs_fulfillment}   onChange={v => set('cogs_fulfillment', v)} />
                  <Field label="Доставка до WB (₽)"  value={form.cogs_inbound_to_wb} onChange={v => set('cogs_inbound_to_wb', v)} />
                  <Field label="Брак/Списания (%)"   value={form.waste_pct}          onChange={v => set('waste_pct', v)} />
                </div>
              </section>

              {/* Логистика */}
              <section>
                <SectionTitle>Логистика {form.fulfillment_mode}</SectionTitle>
                {form.fulfillment_mode === 'FBO' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Логистика WB (₽)"   value={form.fbo_wb_logistics} onChange={v => set('fbo_wb_logistics', v)} />
                    <Field label="Хранение (₽)"        value={form.fbo_storage}      onChange={v => set('fbo_storage', v)} />
                    <Field label="Потери на возврат (₽)" value={form.return_loss}    onChange={v => set('return_loss', v)} />
                    <Field label="Прочее (₽)"           value={form.fbo_other}       onChange={v => set('fbo_other', v)} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Последняя миля (₽)"  value={form.fbs_last_mile}   onChange={v => set('fbs_last_mile', v)} />
                    <Field label="Операционные (₽)"    value={form.fbs_ops}         onChange={v => set('fbs_ops', v)} />
                    <Field label="Хранение (₽)"        value={form.fbs_storage}     onChange={v => set('fbs_storage', v)} />
                    <Field label="Потери на возврат (₽)" value={form.return_loss}   onChange={v => set('return_loss', v)} />
                    <Field label="Прочее (₽)"           value={form.fbs_other}      onChange={v => set('fbs_other', v)} />
                  </div>
                )}
              </section>

              {/* Маркетинг */}
              <section>
                <SectionTitle>Маркетинг</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CAC (₽)" hint="Стоимость привлечения" value={form.cac} onChange={v => set('cac', v)} />
                  <Field label="Доля платного трафика (%)" value={form.paid_share_pct} onChange={v => set('paid_share_pct', v)} />
                  <Field label="Пост. расходы/мес (₽)" value={form.fixed_monthly} onChange={v => set('fixed_monthly', v)} />
                </div>
              </section>
            </div>

            {/* ── Right: Results ── */}
            <div className="p-6 bg-secondary/20">
              <SectionTitle>Результат расчёта</SectionTitle>

              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className={`rounded-md p-4 border ${result.isProfitable ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    {result.isProfitable
                      ? <TrendingUp  className="w-4 h-4 text-success" />
                      : <TrendingDown className="w-4 h-4 text-destructive" />
                    }
                    <span className="text-[11px] text-muted-foreground font-medium">Contribution</span>
                  </div>
                  <p className={`text-xl font-bold ${result.isProfitable ? 'text-success' : 'text-destructive'}`}>
                    {formatRub(result.contribution)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatPct(result.contributionPct)}</p>
                </div>

                <div className="bg-card rounded-md border border-border p-4">
                  <p className="text-[11px] text-muted-foreground font-medium mb-2">Валовая маржа</p>
                  <p className="text-xl font-bold">{formatPct(result.grossMarginPct)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatRub(result.grossProfit)}</p>
                </div>

                {result.bepUnits != null && (
                  <div className="bg-card rounded-md border border-border p-4 col-span-2">
                    <p className="text-[11px] text-muted-foreground font-medium mb-2">Точка безубыточности</p>
                    <p className={`text-xl font-bold ${result.isProfitable ? 'text-foreground' : 'text-destructive'}`}>
                      {result.isProfitable ? `${Math.ceil(result.bepUnits)} шт/мес` : 'Не окупается'}
                    </p>
                  </div>
                )}
              </div>

              {!result.isProfitable && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-destructive rounded-md p-3 mb-4 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Текущая модель убыточна. Точка безубыточности недостижима при данных вводных.</span>
                </div>
              )}

              {/* Breakdown */}
              <div className="bg-card rounded-md border border-border p-4">
                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3">Детализация P&L</h4>
                <ResultRow label="Цена для расчёта"         value={formatRub(result.priceNet)} />
                <ResultRow label="Налог"                    value={`− ${formatRub(result.tax)}`} />
                <ResultRow label="Эквайринг"                value={`− ${formatRub(result.acquiring)}`} />
                <ResultRow label="Комиссия WB"              value={`− ${formatRub(result.wbFee)}`} />
                <ResultRow label="Промо"                    value={`− ${formatRub(result.promo)}`} />
                <ResultRow label="Чистая выручка"           value={formatRub(result.revenueNet)} bold />
                <ResultRow label="Себестоимость с браком"   value={`− ${formatRub(result.cogsWithWaste)}`} />
                <ResultRow label="Логистика/хранение"       value={`− ${formatRub(result.channelVar)}`} />
                <ResultRow label="Потери на возвраты"       value={`− ${formatRub(result.returnLossPerSale)}`} />
                <ResultRow label="Валовая прибыль"          value={formatRub(result.grossProfit)} bold highlight={result.grossProfit >= 0 ? 'pos' : 'neg'} />
                <ResultRow label="Маркетинг на единицу"     value={`− ${formatRub(result.marketingCost)}`} />
                <ResultRow label="Contribution margin"      value={formatRub(result.contribution)} bold highlight={result.contribution >= 0 ? 'pos' : 'neg'} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" className="flex-1 rounded-md" onClick={onClose}>Отмена</Button>
          <Button
            className="flex-1 rounded-md"
            onClick={() => mut.mutate(form)}
            disabled={!form.product_id || mut.isPending}
          >
            {mut.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Сохранить расчёт'}
          </Button>
        </div>
      </div>
    </div>
  );
}
