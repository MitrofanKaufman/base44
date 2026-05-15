import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getCalculatorParameterDoc } from '@/lib/calculatorParameterDocs';
import { cn } from '@/lib/utils';

export default function CalculatorParameterTooltip({ field, className = '' }) {
  const doc = getCalculatorParameterDoc(field);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring',
              className,
            )}
            aria-label={`Подсказка: ${doc.label}`}
          >
            <Info className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-[280px] bg-popover text-popover-foreground border border-border shadow-warm-sm">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold leading-tight">
              {doc.label}{doc.unit ? `, ${doc.unit}` : ''}
            </p>
            <p className="text-[10px] leading-snug text-muted-foreground">{doc.tooltip}</p>
            {doc.formula && (
              <p className="text-[9px] leading-snug text-muted-foreground/80">{doc.formula}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
