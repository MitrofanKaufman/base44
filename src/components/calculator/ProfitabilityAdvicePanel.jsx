import { AlertTriangle, CheckCircle2, Info, Lightbulb, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatRub } from '@/lib/unitEconomics';

const severityStyles = {
  critical: {
    icon: AlertTriangle,
    panel: 'border-destructive/30 bg-destructive/5',
    iconBox: 'bg-destructive/10 text-destructive',
    title: 'text-destructive',
    badge: 'bg-destructive/10 text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    panel: 'border-warning/30 bg-warning/5',
    iconBox: 'bg-warning/10 text-warning',
    title: 'text-warning',
    badge: 'bg-warning/10 text-warning',
  },
  info: {
    icon: Info,
    panel: 'border-primary/25 bg-primary/5',
    iconBox: 'bg-primary/10 text-primary',
    title: 'text-primary',
    badge: 'bg-primary/10 text-primary',
  },
  success: {
    icon: CheckCircle2,
    panel: 'border-emerald-200 bg-emerald-50',
    iconBox: 'bg-emerald-100 text-emerald-700',
    title: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
  },
};

const severityLabel = {
  critical: 'Критично',
  warning: 'Внимание',
  info: 'Совет',
  success: 'ОК',
};

const getSeverityStyle = (severity) => severityStyles[severity] || severityStyles.info;

export default function ProfitabilityAdvicePanel({ advice, setField }) {
  if (!advice) return null;

  const summaryStyle = getSeverityStyle(advice.summary?.severity);
  const SummaryIcon = summaryStyle.icon;
  const visibleItems = advice.items.slice(0, 4);

  const handleApply = (item) => {
    if (item.field !== 'price' || !Number.isFinite(item.recommendedValue)) return;
    setField('price', item.recommendedValue);
  };

  return (
    <div className={cn('bg-card rounded-lg border border-border shadow-warm-sm p-3 h-full')}>
      <div className="flex items-center gap-1.5 mb-3">
        <Lightbulb className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
          Подсказки прибыльности
        </span>
      </div>

      <div className={cn('rounded-md border p-3 mb-3', summaryStyle.panel)}>
        <div className="flex items-start gap-2">
          <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0', summaryStyle.iconBox)}>
            <SummaryIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className={cn('text-sm font-bold leading-tight', summaryStyle.title)}>
              {advice.summary.title}
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-1">
              {advice.summary.message}
            </p>
          </div>
        </div>
      </div>

      {visibleItems.length > 0 ? (
        <div className="space-y-2">
          {visibleItems.map((item) => {
            const itemStyle = getSeverityStyle(item.severity);
            const ItemIcon = itemStyle.icon;
            const canApplyPrice = item.canApply && item.field === 'price' && Number.isFinite(item.recommendedValue);

            return (
              <div key={item.id} className="rounded-md border border-border/70 bg-secondary/20 p-2.5">
                <div className="flex items-start gap-2">
                  <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', itemStyle.iconBox)}>
                    <ItemIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="text-[12px] font-bold text-foreground leading-tight flex-1">
                        {item.title}
                      </p>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0', itemStyle.badge)}>
                        {severityLabel[item.severity] || 'Совет'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-1">
                      {item.message}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {item.impactRub > 0 && (
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          Влияние: {formatRub(item.impactRub)}
                        </span>
                      )}
                      {Number.isFinite(item.projectedContribution) && (
                        <span className="text-[10px] font-semibold text-success">
                          После изменения: {formatRub(item.projectedContribution)}
                        </span>
                      )}
                    </div>
                    {canApplyPrice && (
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2 h-7 text-[11px] font-bold gap-1.5"
                        onClick={() => handleApply(item)}
                      >
                        <Zap className="w-3 h-3" />
                        Применить цену {formatRub(item.recommendedValue)}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-700">
          Критичных вводных нет. Следите за планом продаж и переменными затратами при изменении цены.
        </div>
      )}
    </div>
  );
}
