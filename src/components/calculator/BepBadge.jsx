import { Target } from 'lucide-react';

export default function BepBadge({ result }) {
  if (!result) return null;

  const profitable = result.isProfitable && result.bepUnits;

  return (
    <div className={`w-28 sm:w-32 flex-shrink-0 flex flex-col items-center justify-center p-3 border-r border-border ${profitable ? 'bg-emerald-50' : 'bg-red-50'}`}>
      <div className="flex items-center gap-1 mb-1">
        <Target className={`w-3 h-3 ${profitable ? 'text-emerald-600' : 'text-destructive'}`} />
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">БТБ</span>
      </div>
      <p className={`text-2xl font-bold leading-none ${profitable ? 'text-emerald-700' : 'text-destructive'}`}>
        {profitable ? Math.ceil(result.bepUnits) : '∞'}
      </p>
      {profitable && (
        <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">шт./мес.</p>
      )}
      <p className="text-[9px] text-muted-foreground mt-1 text-center leading-snug">
        {profitable ? 'мин. для выхода в ноль' : 'модель убыточна'}
      </p>
    </div>
  );
}