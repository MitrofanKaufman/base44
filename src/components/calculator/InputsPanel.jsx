import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ContribGauge from './ContribGauge';

const TABS = ['Себестоимость', 'Логистика', 'Маркетинг'];

const FLabel = ({ children, hint }) => (
  <div>
    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
    {hint && <span className="ml-1 text-[9px] text-muted-foreground/60">({hint})</span>}
  </div>
);

const NumInput = ({ label, value, onChange, hint, step = '1', suffix }) => (
  <div className="space-y-1">
    <FLabel hint={hint}>{label}</FLabel>
    <div className="relative">
      <Input
        className="h-8 text-sm rounded-md pr-6"
        type="number"
        step={step}
        min="0"
        value={value ?? ''}
        onChange={e => onChange(+e.target.value)}
        placeholder="0"
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-semibold pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

export default function InputsPanel({ form, setField, result }) {
  const [tab, setTab] = useState(0);
  const isFBS = form.fulfillment_mode === 'FBS';

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm p-4">
      {/* Top: tabs + gauge side-by-side */}
      <div className="flex gap-4 items-start">
        {/* Left: tabs + inputs */}
        <div className="flex-1 min-w-0">
          <div className="flex gap-1 mb-4 bg-secondary/40 rounded-md p-1">
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-semibold rounded-md transition-all',
                  tab === i
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <NumInput label="Закупка"        value={form.cogs_purchase}      onChange={v => setField('cogs_purchase', v)}      suffix="₽" />
              <NumInput label="Упаковка"        value={form.cogs_packaging}     onChange={v => setField('cogs_packaging', v)}     suffix="₽" />
              <NumInput label="Сборка/фулф."   value={form.cogs_fulfillment}   onChange={v => setField('cogs_fulfillment', v)}   suffix="₽" />
              <NumInput label="До WB"           value={form.cogs_inbound_to_wb} onChange={v => setField('cogs_inbound_to_wb', v)} suffix="₽" />
              <NumInput label="Брак/Списания"   value={form.waste_pct}          onChange={v => setField('waste_pct', v)}          suffix="%" step="0.1" />
              <NumInput label="Промо/Акция"     value={form.promo_pct}          onChange={v => setField('promo_pct', v)}          suffix="%" step="0.1" />
            </div>
          )}

          {tab === 1 && (
            <div>
              <div className="inline-flex gap-1 mb-3 bg-secondary/40 rounded-md p-1">
                {['FBO', 'FBS'].map(m => (
                  <button
                    key={m}
                    onClick={() => setField('fulfillment_mode', m)}
                    className={cn(
                      'px-4 py-1 text-xs font-semibold rounded-md transition-all',
                      form.fulfillment_mode === m
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {!isFBS ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NumInput label="Логистика WB"   value={form.fbo_wb_logistics} onChange={v => setField('fbo_wb_logistics', v)} suffix="₽" />
                  <NumInput label="Хранение FBO"   value={form.fbo_storage}      onChange={v => setField('fbo_storage', v)}      suffix="₽" />
                  <NumInput label="Потери возврат" value={form.return_loss}      onChange={v => setField('return_loss', v)}      suffix="₽" />
                  <NumInput label="% возвратов"    value={form.return_rate_pct}  onChange={v => setField('return_rate_pct', v)}  suffix="%" step="0.1" />
                  <NumInput label="Прочее FBO"     value={form.fbo_other}        onChange={v => setField('fbo_other', v)}        suffix="₽" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NumInput label="Последняя миля"  value={form.fbs_last_mile}  onChange={v => setField('fbs_last_mile', v)}  suffix="₽" />
                  <NumInput label="Операционные"    value={form.fbs_ops}        onChange={v => setField('fbs_ops', v)}        suffix="₽" />
                  <NumInput label="Хранение FBS"    value={form.fbs_storage}    onChange={v => setField('fbs_storage', v)}    suffix="₽" />
                  <NumInput label="Потери возврат"  value={form.return_loss}    onChange={v => setField('return_loss', v)}    suffix="₽" />
                  <NumInput label="% возвратов"     value={form.return_rate_pct} onChange={v => setField('return_rate_pct', v)} suffix="%" step="0.1" />
                  <NumInput label="Прочее FBS"      value={form.fbs_other}      onChange={v => setField('fbs_other', v)}      suffix="₽" />
                </div>
              )}
            </div>
          )}

          {tab === 2 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <NumInput label="CAC"                  value={form.cac}            onChange={v => setField('cac', v)}            hint="стоим. привл." suffix="₽" />
              <NumInput label="Платный трафик"       value={form.paid_share_pct} onChange={v => setField('paid_share_pct', v)} suffix="%" step="0.1" />
              <NumInput label="Пост. расходы/мес"    value={form.fixed_monthly}  onChange={v => setField('fixed_monthly', v)}  suffix="₽" />
              <NumInput label="Налог"                value={form.tax_pct}        onChange={v => setField('tax_pct', v)}        suffix="%" step="0.1" />
              <NumInput label="Эквайринг"            value={form.acquiring_pct}  onChange={v => setField('acquiring_pct', v)}  suffix="%" step="0.1" />
            </div>
          )}
        </div>

        {/* Right: compact gauge */}
        <div className="flex-shrink-0 hidden lg:block">
          <ContribGauge result={result} compact />
        </div>
      </div>
    </div>
  );
}