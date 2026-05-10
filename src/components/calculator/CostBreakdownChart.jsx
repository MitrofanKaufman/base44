import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { calculate, formatRub, formatPct } from '@/lib/unitEconomics';

const SLICES = [
  { key: 'cogs_purchase',    label: 'Закупка',      color: '#9a3412' },
  { key: 'cogs_packaging',   label: 'Упаковка',     color: '#c2410c' },
  { key: 'cogs_fulfillment', label: 'Сборка',       color: '#ea580c' },
  { key: 'logistics',        label: 'Логистика WB', color: '#3b82f6' },
  { key: 'commission',       label: 'Комиссия WB',  color: '#8b5cf6' },
  { key: 'tax',              label: 'Налог',        color: '#10b981' },
  { key: 'marketing',        label: 'Реклама',      color: '#f59e0b' },
  { key: 'acquiring',        label: 'Эквайринг',    color: '#6366f1' },
  { key: 'return',           label: 'Возвраты',     color: '#ec4899' },
];

function buildSlices(form, result) {
  const isFBS = form.fulfillment_mode === 'FBS';
  const logisticsVal = isFBS
    ? (form.fbs_last_mile || 0) + (form.fbs_ops || 0) + (form.fbs_storage || 0) + (form.fbs_other || 0)
    : (form.fbo_wb_logistics || 0) + (form.fbo_storage || 0) + (form.fbo_other || 0);

  const raw = {
    cogs_purchase:    form.cogs_purchase    || 0,
    cogs_packaging:   form.cogs_packaging   || 0,
    cogs_fulfillment: form.cogs_fulfillment || 0,
    logistics:        logisticsVal + (form.cogs_inbound_to_wb || 0),
    commission:       result.priceNet * (form.wb_commission_pct || 0) / 100,
    tax:              result.priceNet * (form.tax_pct || 0) / 100,
    marketing:        result.marketingCost  || 0,
    acquiring:        result.priceNet * (form.acquiring_pct || 0) / 100,
    return:           form.return_loss      || 0,
  };

  const total = Object.values(raw).reduce((s, v) => s + Math.max(0, v), 0);
  if (total === 0) return [];

  return SLICES
    .map(s => ({ ...s, value: Math.max(0, raw[s.key]), pct: total > 0 ? (Math.max(0, raw[s.key]) / total) * 100 : 0 }))
    .filter(s => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-warm text-xs space-y-0.5">
      <p className="font-bold text-foreground">{d.label}</p>
      <p className="text-muted-foreground">{formatRub(d.value)} <span className="font-semibold text-foreground">· {d.pct.toFixed(1)}%</span></p>
    </div>
  );
};

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
  if (pct < 5) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
      {pct.toFixed(0)}%
    </text>
  );
};

export default function CostBreakdownChart({ form }) {
  const result = useMemo(() => calculate(form), [form]);
  const slices = useMemo(() => buildSlices(form, result), [form, result]);
  const total  = slices.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm p-4">
      <div className="flex items-center gap-2 mb-4">
        <PieIcon className="w-4 h-4 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Структура затрат</span>
        {total > 0 && (
          <span className="ml-auto text-xs text-muted-foreground font-semibold">Итого: {formatRub(total)}</span>
        )}
      </div>

      {slices.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">
          Введите данные для отображения диаграммы
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          {/* Pie */}
          <div className="flex-shrink-0" style={{ width: 180, height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={78}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {slices.map((s, i) => (
                    <Cell key={i} fill={s.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend table */}
          <div className="w-full space-y-1 min-w-0">
            {slices.map(s => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                <span className="text-[11px] text-muted-foreground flex-1 truncate">{s.label}</span>
                <span className="text-[11px] font-mono font-bold text-foreground">{formatRub(s.value)}</span>
                <span className="text-[10px] font-semibold text-muted-foreground w-9 text-right">{s.pct.toFixed(1)}%</span>
              </div>
            ))}
            <div className="pt-1.5 border-t border-border flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm flex-shrink-0 border-2" style={{ borderColor: result.contribution >= 0 ? '#10b981' : '#dc2626' }} />
              <span className="text-[11px] font-semibold text-foreground flex-1">Contribution</span>
              <span className={`text-[11px] font-mono font-bold ${result.contribution >= 0 ? 'text-success' : 'text-destructive'}`}>{formatRub(result.contribution)}</span>
              <span className={`text-[10px] font-semibold w-9 text-right ${result.contribution >= 0 ? 'text-success' : 'text-destructive'}`}>
                {result.priceNet > 0 ? formatPct(result.contribution / result.priceNet * 100) : '—'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
