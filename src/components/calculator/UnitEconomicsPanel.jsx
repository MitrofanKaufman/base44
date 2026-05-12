import { TrendingUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ratioToPercent } from '@/lib/unitEconomics';
import { buildCalculatorViewModel } from '@/lib/calculatorViewModel';

const MetricCard = ({ label, value, suffix = '', trend = 0, alert = false }) => (
  <div className={cn(
    'p-3 rounded-lg border transition-colors',
    alert ? 'bg-destructive/5 border-destructive/30' : 'bg-secondary/30 border-border/50'
  )}>
    <div className="text-[10px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">
      {label}
    </div>
    <div className={cn(
      'text-lg font-bold flex items-baseline gap-1',
      alert ? 'text-destructive' : 'text-foreground'
    )}>
      <span>{value}</span>
      <span className="text-[11px] text-muted-foreground">{suffix}</span>
    </div>
    {trend && (
      <div className="text-[9px] mt-1.5 flex items-center gap-1">
        <TrendingUp className={cn('w-3 h-3', trend > 0 ? 'text-success' : 'text-destructive')} />
        <span className={trend > 0 ? 'text-success' : 'text-destructive'}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      </div>
    )}
  </div>
);

export default function UnitEconomicsPanel({ form, result }) {
  if (!result) {
    return (
      <div className="bg-card rounded-[18px] border border-border shadow-warm-sm p-4 flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Введите параметры товара</p>
        </div>
      </div>
    );
  }

  const priceNet = result.priceNet ?? 0;
  const view = buildCalculatorViewModel(form, result);
  const grossProfit = result.grossProfit ?? 0;
  const grossMarginPct = result.grossMarginPct ?? 0;
  const grossMarginDisplay = ratioToPercent(grossMarginPct);
  const contribution = result.contribution ?? 0;
  const contributionPct = result.contributionPct ?? 0;
  const contributionDisplay = ratioToPercent(contributionPct);
  const varCost = result.varCost ?? 0;
  const cogsWithWaste = result.cogsWithWaste ?? 0;
  const isProfitable = result.isProfitable ?? contribution > 0;

  // Рассчитываем дополнительные метрики
  const roi = cogsWithWaste > 0 ? ((contribution / cogsWithWaste) * 100) : 0;
  const returnOnMarketing = result.marketingCost > 0 && contribution > 0
    ? ((contribution / result.marketingCost) - 1) * 100
    : 0;

  return (
    <div className="bg-card rounded-[18px] border border-border shadow-warm-sm p-4 h-full flex flex-col">
      {/* Заголовок */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/40">
        <div className="w-5 h-5 rounded-md flex items-center justify-center bg-emerald-100 text-emerald-600 flex-shrink-0">
          <TrendingUp className="w-3 h-3" />
        </div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground">
          Юнит-экономика
        </h3>
        {isProfitable ? (
          <span className="ml-auto text-[9px] font-bold bg-success/10 text-success px-2 py-1 rounded">
            ✓ Прибыльно
          </span>
        ) : (
          <span className="ml-auto text-[9px] font-bold bg-destructive/10 text-destructive px-2 py-1 rounded">
            ✗ Убыточно
          </span>
        )}
      </div>

      {/* Основные метрики (3x2 сетка) */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricCard
          label="Цена продажи"
          value={priceNet.toFixed(0)}
          suffix="₽"
        />
        <MetricCard
          label="Маржинальность"
          value={grossMarginDisplay.toFixed(1)}
          suffix="%"
          trend={grossMarginPct > 0.3 ? 1 : -1}
          alert={grossMarginPct < 0.15}
        />
        <MetricCard
          label="Contribution"
          value={contribution.toFixed(0)}
          suffix="₽"
          alert={contribution < 0}
        />
        <MetricCard
          label="ROI"
          value={roi.toFixed(1)}
          suffix="%"
          alert={roi < 50}
        />
        <MetricCard
          label="Себестоимость"
          value={cogsWithWaste.toFixed(0)}
          suffix="₽"
        />
        <MetricCard
          label="Маржа %"
          value={contributionDisplay.toFixed(1)}
          suffix="%"
          alert={contributionPct < 0.2}
        />
      </div>

      {/* Дополнительные показатели */}
      <div className="space-y-2 mt-auto pt-3 border-t border-border/40">
        {result.marketingCost > 0 && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">ROAS (CAC):</span>
            <span className={cn(
              'font-bold',
              returnOnMarketing > 0 ? 'text-success' : 'text-destructive'
            )}>
              {returnOnMarketing.toFixed(1)}%
            </span>
          </div>
        )}
        
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Точка безубыточности:</span>
          <span className="font-bold text-foreground">
            {view.bep.isReachable ? `${view.bep.display}/мес` : 'Не окупается'}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Переменные затраты:</span>
          <span className="font-bold text-foreground">{varCost.toFixed(0)}₽</span>
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Валовая прибыль:</span>
          <span className="font-bold text-foreground">{grossProfit.toFixed(0)}₽</span>
        </div>
      </div>

      {/* Рекомендация */}
      {!isProfitable && contribution < 0 && (
        <div className="mt-4 p-2.5 rounded-lg bg-destructive/5 border border-destructive/30 text-[9px] text-destructive flex gap-2">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>Товар убыточен. Увеличьте цену или снизьте затраты.</span>
        </div>
      )}

      {isProfitable && contributionPct < 0.2 && (
        <div className="mt-4 p-2.5 rounded-lg bg-warning/5 border border-warning/30 text-[9px] text-warning flex gap-2">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>Низкая маржа. Оптимизируйте себестоимость или посмотрите конкурентов.</span>
        </div>
      )}
    </div>
  );
}
