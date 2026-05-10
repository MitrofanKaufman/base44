import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { formatRub } from '@/lib/unitEconomics';
import { TrendingUp, TrendingDown } from 'lucide-react';

/**
 * Виджет "Динамика contribution / gross по расчётам"
 * Принимает массив calculations (уже отсортированных по дате).
 * productFilter — опциональный product_id для фильтрации.
 */
export default function SalesDynamicsChart({ calculations, productFilter, title = 'Динамика расчётов' }) {
  const data = useMemo(() => {
    let src = [...calculations].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    if (productFilter) src = src.filter(c => c.product_id === productFilter);
    return src.slice(-20).map((c, i) => ({
      name:        c.name?.slice(0, 14) || `#${i + 1}`,
      contribution: c.contribution     ?? 0,
      grossProfit:  c.gross_profit      ?? 0,
      margin:       c.gross_margin_pct  ?? 0,
      date:         c.created_date
        ? new Date(c.created_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
        : `#${i + 1}`,
    }));
  }, [calculations, productFilter]);

  if (data.length < 2) {
    return (
      <div className="bg-card rounded-lg border border-border shadow-warm-sm p-6 text-center">
        <TrendingUp className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Недостаточно расчётов для графика (нужно минимум 2)</p>
      </div>
    );
  }

  const lastContrib = data[data.length - 1]?.contribution || 0;
  const prevContrib = data[data.length - 2]?.contribution || 0;
  const delta = lastContrib - prevContrib;
  const deltaPos = delta >= 0;

  const tooltipStyle = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 10,
    fontSize: 11,
    boxShadow: '0 8px 24px rgba(61,38,20,.10)',
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${
            deltaPos ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-destructive'
          }`}>
            {deltaPos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {deltaPos ? '+' : ''}{formatRub(delta)}
          </div>
          <span className="text-xs text-muted-foreground">{data.length} расчётов</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}₽`}
            width={56}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v, name) => [formatRub(v), name === 'contribution' ? 'Contribution' : 'Вал. прибыль']}
          />
          <Legend
            formatter={v => v === 'contribution' ? 'Contribution' : 'Вал. прибыль'}
            wrapperStyle={{ fontSize: 11 }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 2" strokeWidth={1} />
          <Line
            type="monotone"
            dataKey="contribution"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="grossProfit"
            stroke="#60a5fa"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}