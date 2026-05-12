import { formatRub, formatPct } from '@/lib/unitEconomics';
import { buildCalculatorViewModel } from '@/lib/calculatorViewModel';
import { PieChart, TrendingUp, Target } from 'lucide-react';

const Row = ({ label, value, indent = false, bold = false, color = undefined }) => (
  <div className={`flex items-center justify-between py-1.5 border-b border-border/40 last:border-0 ${indent ? 'pl-3' : ''}`}>
    <span className={`text-[11px] leading-tight ${indent ? 'text-muted-foreground' : bold ? 'text-foreground font-semibold' : 'text-foreground'}`}>{label}</span>
    <span className={`text-[12px] font-mono font-bold flex-shrink-0 ml-2 ${color || 'text-foreground'}`}>{value}</span>
  </div>
);

export default function FinancialSummary({ result, form }) {
  const view = buildCalculatorViewModel(form, result);
  const monthlyUnits = view.monthly.units;
  const monthlyRevenue = view.monthly.revenue;
  const monthlyProfit = view.monthly.profit;
  const profitability  = result.contributionPct ?? 0;
  const romi           = result.marketingCost > 0 ? (result.contribution / result.marketingCost) * 100 : null;
  const safetyMargin   = view.monthly.safetyMargin;
  const bep = view.bep;
  const hasMonthlyPlan = monthlyUnits !== undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_200px] gap-3">

      {/* Финансовая расшифровка */}
      <div className="bg-card rounded-lg border border-border shadow-warm-sm p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <PieChart className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Финансовая расшифровка</span>
        </div>
        <Row label={hasMonthlyPlan ? `Выручка в месяц (${Math.round(monthlyUnits)} шт.)` : 'Выручка в месяц'} value={formatRub(monthlyRevenue)} bold />
        <Row label="Чистая выручка (за ед.)"   value={formatRub(result.revenueNet)} indent />
        <Row label="Себестоимость"             value={formatRub(result.cogsWithWaste)} color="text-destructive" />
        <Row label="Валовая прибыль"           value={formatRub(result.grossProfit)}  bold color={result.grossProfit >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="Contribution margin"       value={formatRub(result.contribution)} bold color={result.contribution >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="Прибыль в месяц"           value={formatRub(monthlyProfit)}       bold color={monthlyProfit == null ? undefined : monthlyProfit >= 0 ? 'text-success' : 'text-destructive'} />
      </div>

      {/* Ключевые метрики */}
      <div className="bg-card rounded-lg border border-border shadow-warm-sm p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Ключевые метрики</span>
        </div>
        <Row label="Валовая прибыль"             value={formatRub(result.grossProfit)}  color={result.grossProfit >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="Contribution margin"         value={formatRub(result.contribution)} color={result.contribution >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="Маржинальность"              value={formatPct(result.grossMarginPct, 'ratio')} />
        <Row label="Операционная прибыль / мес." value={formatRub(monthlyProfit)} bold  color={monthlyProfit == null ? undefined : monthlyProfit >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="Рентабельность"              value={formatPct(profitability, 'ratio')}        color={profitability >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="ROMI маркетинга"             value={romi != null ? formatPct(romi, 'percent') : '—'} />
      </div>

      {/* BEP блок */}
      <div className="bg-card rounded-lg border border-border shadow-warm-sm p-3 flex flex-col gap-1.5">
        <div className={`rounded-md p-2.5 border ${bep.isReachable ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-1 mb-1">
            <Target className={`w-3 h-3 ${bep.isReachable ? 'text-emerald-600' : 'text-destructive'}`} />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Точка безубыточности</span>
          </div>
          <p className={`text-xl font-bold leading-none ${bep.isReachable ? 'text-emerald-700' : 'text-destructive'}`}>
            {bep.display}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
            {bep.status === 'no_fixed_costs' ? 'постоянных расходов нет' : bep.isReachable ? 'мин. продаж/мес для выхода в ноль' : 'модель убыточна'}
          </p>
          {bep.isReachable && hasMonthlyPlan && (
            <div className="mt-2">
              <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                <span>План: {Math.round(monthlyUnits)} шт.</span>
                <span>{safetyMargin != null && safetyMargin >= 0 ? `+${safetyMargin}` : `−${Math.abs(safetyMargin ?? 0)}`}</span>
              </div>
              <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full ${safetyMargin != null && safetyMargin >= 0 ? 'bg-emerald-500' : 'bg-destructive'}`}
                  style={{ width: `${bep.units === 0 ? 0 : Math.min(100, (bep.units / Math.max(monthlyUnits, bep.units)) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <Row label="Запас прочности" value={safetyMargin != null ? `${safetyMargin} шт.` : '—'} />
        <Row label="CAC"             value={formatRub(result.marketingCost)} />
        <Row label="Доля маркетинга" value={result.priceNet > 0 ? formatPct(result.marketingCost / result.priceNet, 'ratio') : '—'} />
      </div>
    </div>
  );
}
