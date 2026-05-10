import { formatRub, formatPct } from '@/lib/unitEconomics';
import { TrendingUp, TrendingDown, ShoppingCart, BarChart2, DollarSign, Activity } from 'lucide-react';

const Metric = ({ label, value, icon: Icon, color = 'text-foreground', bg = 'bg-secondary/40' }) => (
  <div className="flex items-center justify-between py-2.5 px-3 rounded-md border border-border hover:bg-muted/30 transition-colors">
    <div className="flex items-center gap-2">
      <div className={`w-6 h-6 rounded-md ${bg} flex items-center justify-center`}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
    <span className={`text-sm font-bold ${color}`}>{value}</span>
  </div>
);

export default function MetricsPanel({ result }) {
  const rows = [
    {
      label: 'Чистая выручка',
      value: formatRub(result.revenueNet),
      icon: DollarSign,
      color: 'text-foreground',
      bg: 'bg-blue-50',
    },
    {
      label: 'Себестоимость',
      value: formatRub(result.cogsWithWaste),
      icon: ShoppingCart,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
    },
    {
      label: 'Валовая прибыль',
      value: formatRub(result.grossProfit),
      icon: result.grossProfit >= 0 ? TrendingUp : TrendingDown,
      color: result.grossProfit >= 0 ? 'text-success' : 'text-destructive',
      bg:    result.grossProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50',
    },
    {
      label: 'Маржа',
      value: formatPct(result.grossMarginPct),
      icon: BarChart2,
      color: result.grossMarginPct >= 0 ? 'text-success' : 'text-destructive',
      bg: 'bg-secondary/40',
    },
    {
      label: 'Дата расч.',
      value: new Date().toLocaleDateString('ru-RU'),
      icon: Activity,
      color: 'text-muted-foreground',
      bg: 'bg-secondary/40',
    },
  ];

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Ключевые метрики</p>
      <div className="space-y-1.5">
        {rows.map(r => <Metric key={r.label} {...r} />)}
      </div>

      {/* BEP */}
      {result.bepUnits != null && (
        <div className="mt-3 bg-accent rounded-md p-3 border border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">BEP / Точка безубыточности</p>
          <p className={`text-lg font-bold ${result.isProfitable ? 'text-foreground' : 'text-destructive'}`}>
            {result.isProfitable ? `${Math.ceil(result.bepUnits)} шт/мес` : '∞'}
          </p>
        </div>
      )}
    </div>
  );
}