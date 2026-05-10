import { formatRub, formatPct } from '@/lib/unitEconomics';
import { PieChart, TrendingUp, Target } from 'lucide-react';

const Row = ({ label, value, indent, bold, color }) => (
  <div className={`flex items-center justify-between py-1.5 border-b border-border/40 last:border-0 ${indent ? 'pl-3' : ''}`}>
    <span className={`text-[11px] leading-tight ${indent ? 'text-muted-foreground' : bold ? 'text-foreground font-semibold' : 'text-foreground'}`}>{label}</span>
    <span className={`text-[12px] font-mono font-bold flex-shrink-0 ml-2 ${color || 'text-foreground'}`}>{value}</span>
  </div>
);

export default function FinancialSummary({ result, form }) {
  const monthlyUnits   = form.monthly_plan || (result.isProfitable && result.bepUnits ? Math.ceil(result.bepUnits) * 1.5 : 137);
  const monthlyRevenue = result.revenueNet * monthlyUnits;
  const monthlyProfit  = result.contribution > 0 ? result.contribution * monthlyUnits - (form.fixed_monthly || 0) : 0;
  const profitability  = result.priceNet > 0 ? (result.contribution / result.priceNet * 100) : 0;
  const romi           = result.marketingCost > 0 ? (result.contribution / result.marketingCost) * 100 : null;
  const safetyMargin   = result.isProfitable && result.bepUnits ? Math.round(monthlyUnits - result.bepUnits) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_200px] gap-3">

      {/* Финансовая расшифровка */}
      <div className="bg-card rounded-lg border border-border shadow-warm-sm p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <PieChart className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Финансовая расшифровка</span>
        </div>
        <Row label={`Выручка в месяц (${Math.round(monthlyUnits)} шт.)`} value={formatRub(monthlyRevenue)} bold />
        <Row label="Чистая выручка (за ед.)"   value={formatRub(result.revenueNet)} indent />
        <Row label="Себестоимость"             value={formatRub(result.cogsWithWaste)} color="text-destructive" />
        <Row label="Валовая прибыль"           value={formatRub(result.grossProfit)}  bold color={result.grossProfit >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="Contribution margin"       value={formatRub(result.contribution)} bold color={result.contribution >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="Прибыль в месяц"           value={formatRub(monthlyProfit)}       bold color={monthlyProfit >= 0 ? 'text-success' : 'text-destructive'} />
      </div>

      {/* Ключевые метрики */}
      <div className="bg-card rounded-lg border border-border shadow-warm-sm p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Ключевые метрики</span>
        </div>
        <Row label="Валовая прибыль"             value={formatRub(result.grossProfit)}  color={result.grossProfit >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="Contribution margin"         value={formatRub(result.contribution)} color={result.contribution >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="Маржинальность"              value={formatPct(result.grossMarginPct)} />
        <Row label="Операционная прибыль / мес." value={formatRub(monthlyProfit)} bold  color={monthlyProfit >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="Рентабельность"              value={formatPct(profitability)}        color={profitability >= 0 ? 'text-success' : 'text-destructive'} />
        <Row label="ROMI маркетинга"             value={romi != null ? formatPct(romi) : '—'} />
      </div>

      {/* BEP блок */}
      <div className="bg-card rounded-lg border border-border shadow-warm-sm p-3 flex flex-col gap-1.5">
        <div className={`rounded-md p-2.5 border ${result.isProfitable && result.bepUnits ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-1 mb-1">
            <Target className={`w-3 h-3 ${result.isProfitable && result.bepUnits ? 'text-emerald-600' : 'text-destructive'}`} />
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Точка безубыточности</span>
          </div>
          <p className={`text-xl font-bold leading-none ${result.isProfitable && result.bepUnits ? 'text-emerald-700' : 'text-destructive'}`}>
            {result.isProfitable && result.bepUnits ? `${Math.ceil(result.bepUnits)} шт.` : '∞'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
            {result.isProfitable && result.bepUnits ? 'мин. продаж/мес для выхода в ноль' : 'модель убыточна'}
          </p>
          {result.isProfitable && result.bepUnits && monthlyUnits > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                <span>План: {Math.round(monthlyUnits)} шт.</span>
                <span>{safetyMargin != null && safetyMargin >= 0 ? `+${safetyMargin}` : `−${Math.abs(safetyMargin ?? 0)}`}</span>
              </div>
              <div className="w-full bg-emerald-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full ${safetyMargin != null && safetyMargin >= 0 ? 'bg-emerald-500' : 'bg-destructive'}`}
                  style={{ width: `${Math.min(100, (result.bepUnits / Math.max(monthlyUnits, result.bepUnits)) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <Row label="Запас прочности" value={safetyMargin != null ? `${safetyMargin} шт.` : '—'} />
        <Row label="CAC"             value={formatRub(result.marketingCost)} />
        <Row label="Доля маркетинга" value={result.priceNet > 0 ? formatPct(result.marketingCost / result.priceNet * 100) : '—'} />
      </div>
    </div>
  );
}