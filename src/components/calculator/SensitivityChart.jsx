import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts';
import { calculate, formatRub } from '@/lib/unitEconomics';
import { TrendingUp } from 'lucide-react';

const MODES = [
  { key: 'price',     label: 'Цена продажи',    field: 'price',        unit: '₽',  range: 0.6 },
  { key: 'cogs',      label: 'Себестоимость',   field: 'cogs_purchase', unit: '₽', range: 0.6 },
  { key: 'logistics', label: 'Логистика WB',    field: 'fbo_wb_logistics', unit: '₽', range: 0.8 },
  { key: 'ads',       label: 'Реклама (ACoS)',  field: 'paid_share_pct', unit: '%', range: 1.5 },
];

const STEPS = 20;

function buildData(form, modeKey) {
  const mode = MODES.find(m => m.key === modeKey);
  const base = form[mode.field] || 0;

  // If base is 0, use a sensible default range
  const baseVal = base === 0 ? (modeKey === 'price' ? 1000 : 100) : base;
  const delta = baseVal * mode.range;
  const from = Math.max(0, baseVal - delta);
  const to = baseVal + delta;
  const step = (to - from) / STEPS;

  return Array.from({ length: STEPS + 1 }, (_, i) => {
    const xVal = from + i * step;
    const tweaked = { ...form, [mode.field]: xVal };
    const res = calculate(tweaked);
    return {
      x: Math.round(xVal * 10) / 10,
      contribution: Math.round(res.contribution),
      grossProfit:  Math.round(res.grossProfit),
    };
  });
}

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-warm text-xs space-y-1.5">
      <p className="font-semibold text-foreground">{label}{unit}</p>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className={`font-bold ${p.value >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatRub(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function SensitivityChart({ form }) {
  const [activeMode, setActiveMode] = useState('price');

  const data = useMemo(() => buildData(form, activeMode), [form, activeMode]);
  const mode = MODES.find(m => m.key === activeMode);
  const currentX = Math.round((form[mode.field] || 0) * 10) / 10;

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
            Анализ чувствительности прибыли
          </span>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-0.5 bg-secondary/50 rounded-md p-0.5">
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => setActiveMode(m.key)}
              className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap ${
                activeMode === m.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="x"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}${mode.unit}`}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v >= 1000 || v <= -1000 ? `${Math.round(v / 1000)}к` : v}₽`}
            width={48}
          />
          <Tooltip content={<CustomTooltip unit={mode.unit} />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={v => v === 'contribution' ? 'Contribution margin' : 'Валовая прибыль'}
          />
          <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 3" strokeWidth={1.2} />
          {currentX > 0 && (
            <ReferenceLine
              x={currentX}
              stroke="hsl(var(--primary))"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: 'Текущее', position: 'insideTopRight', fontSize: 9, fill: 'hsl(var(--primary))' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="contribution"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="grossProfit"
            stroke="hsl(var(--success))"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="5 3"
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Hint */}
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        Вертикальная линия — текущее значение · меняйте параметры выше и график обновится мгновенно
      </p>
    </div>
  );
}