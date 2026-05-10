import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatRub, formatPct, calculate } from '@/lib/unitEconomics';
import { TrendingUp } from 'lucide-react';

const SEGMENTS = [
  { key: 'cogs',        label: 'Себестоимость',       color: '#ea580c' },
  { key: 'fees',        label: 'Комиссии и налоги',   color: '#8b5cf6' },
  { key: 'logistics',   label: 'Логистика',           color: '#3b82f6' },
  { key: 'marketing',   label: 'Маркетинг',           color: '#f59e0b' },
  { key: 'profit',      label: 'Чистая прибыль',      color: '#10b981' },
];

function buildData(form, result) {
  const isFBS = form.fulfillment_mode === 'FBS';
  const logisticsVal = isFBS
    ? (form.fbs_last_mile || 0) + (form.fbs_ops || 0) + (form.fbs_storage || 0) + (form.fbs_other || 0)
    : (form.fbo_wb_logistics || 0) + (form.fbo_storage || 0) + (form.fbo_other || 0);

  const cogs = (form.cogs_purchase || 0) + (form.cogs_packaging || 0) + (form.cogs_fulfillment || 0) + (form.cogs_inbound_to_wb || 0);
  const fees = result.priceNet * ((form.wb_commission_pct || 0) + (form.tax_pct || 0) + (form.acquiring_pct || 0)) / 100;
  const logistics = logisticsVal + (form.return_loss || 0);
  const marketing = result.marketingCost || 0;
  const profit = result.contribution;

  const raw = [
    { key: 'cogs',      value: Math.max(0, cogs) },
    { key: 'fees',      value: Math.max(0, fees) },
    { key: 'logistics', value: Math.max(0, logistics) },
    { key: 'marketing', value: Math.max(0, marketing) },
    { key: 'profit',    value: Math.max(0, profit) },
  ];

  const total = raw.reduce((s, d) => s + d.value, 0);
  if (total === 0) return [];

  return raw
    .filter(d => d.value > 0)
    .map(d => ({
      ...SEGMENTS.find(s => s.key === d.key),
      value: d.value,
      pct: (d.value / total) * 100,
    }));
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-warm text-xs space-y-0.5">
      <p className="font-bold text-foreground">{d.label}</p>
      <p className="text-muted-foreground">{formatRub(d.value)} · <span className="font-semibold text-foreground">{d.pct.toFixed(1)}%</span></p>
    </div>
  );
};

const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
  if (pct < 6) return null;
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

export default function ProfitStructureChart({ form }) {
  const result = useMemo(() => calculate(form), [form]);
  const data   = useMemo(() => buildData(form, result), [form, result]);
  const profitable = result.contribution >= 0;

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
          Соотношение себестоимости, комиссий и прибыли
        </span>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
          Введите данные для отображения диаграммы
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          {/* Donut */}
          <div className="flex-shrink-0 relative" style={{ width: 180, height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={78}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={renderLabel}
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className={`text-[15px] font-bold leading-none ${profitable ? 'text-success' : 'text-destructive'}`}>
                {formatPct(Math.abs(result.grossMarginPct))}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">маржа</p>
            </div>
          </div>

          {/* Legend */}
          <div className="w-full space-y-1">
            {data.map(d => (
              <div key={d.key} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                <span className="text-[11px] text-muted-foreground flex-1">{d.label}</span>
                <span className="text-[11px] font-mono font-bold text-foreground">{formatRub(d.value)}</span>
                <span className="text-[10px] font-semibold text-muted-foreground w-9 text-right">{d.pct.toFixed(1)}%</span>
              </div>
            ))}
            <div className="pt-1.5 border-t border-border flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Нетто цена</span>
              <span className="text-[11px] font-bold font-mono text-foreground">{formatRub(result.priceNet)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
