import { useState } from 'react';
import { calculate } from '@/lib/unitEconomics';
import { Zap, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PriceRecommendationPanel({ form, setField, result }) {
  const [targetMargin, setTargetMargin] = useState(30);

  // Рассчитываем все переменные затраты на единицу
  const varCosts = result.varCost || 0;
  
  // Рекомендованная цена = Затраты / (1 - желаемая маржа)
  const recommendedPrice = varCosts > 0 
    ? Math.round((varCosts / (1 - targetMargin / 100)) * 100) / 100
    : 0;

  const handleApplyPrice = () => {
    setField('price', recommendedPrice);
  };

  const projectedResult = calculate({ ...form, price: recommendedPrice });

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm p-3">
      <div className="flex items-center gap-1.5 mb-3">
        <TrendingUp className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">Рекомендованная цена</span>
      </div>

      {/* Желаемая маржинальность */}
      <div className="mb-3 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] text-muted-foreground">Желаемая маржинальность</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={targetMargin}
              onChange={e => setTargetMargin(Math.max(0, Math.min(100, +e.target.value)))}
              className="w-12 h-6 bg-secondary/40 border border-border rounded px-1 text-[11px] font-bold text-right focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-[10px] text-muted-foreground">%</span>
          </div>
        </div>
        <div className="w-full bg-secondary/30 rounded-full h-1.5">
          <div
            className="h-1.5 bg-primary rounded-full transition-all"
            style={{ width: `${targetMargin}%` }}
          />
        </div>
      </div>

      {/* Расчет */}
      <div className="space-y-2 mb-3 text-[10px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Переменные затраты:</span>
          <span className="font-mono font-bold">{varCosts.toFixed(2)} ₽</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Целевая маржа:</span>
          <span className="font-mono font-bold">{targetMargin}%</span>
        </div>
        <div className="flex justify-between py-1.5 border-t border-border/40">
          <span className="font-semibold text-foreground">Рекомендованная цена:</span>
          <span className="font-mono text-base font-bold text-primary">{recommendedPrice.toFixed(0)} ₽</span>
        </div>
      </div>

      {/* Прогноз маржи при рекомендованной цене */}
      {projectedResult && (
        <div className="space-y-1 mb-3 p-2 bg-secondary/30 rounded text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Чистая выручка:</span>
            <span className="font-mono font-bold">{projectedResult.revenueNet?.toFixed(2) || '—'} ₽</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Контрибьюшн:</span>
            <span className={`font-mono font-bold ${projectedResult.contribution >= 0 ? 'text-success' : 'text-destructive'}`}>
              {projectedResult.contribution?.toFixed(2) || '—'} ₽
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Маржинальность:</span>
            <span className={`font-mono font-bold ${projectedResult.grossMarginPct >= targetMargin - 2 ? 'text-success' : 'text-warning'}`}>
              {projectedResult.grossMarginPct?.toFixed(1) || '—'}%
            </span>
          </div>
        </div>
      )}

      {/* Кнопка применения */}
      <Button
        onClick={handleApplyPrice}
        className="w-full h-8 text-[11px] font-bold gap-1.5"
        variant={form.price === recommendedPrice ? 'outline' : 'default'}
      >
        <Zap className="w-3 h-3" />
        {form.price === recommendedPrice ? 'Цена применена' : 'Применить цену'}
      </Button>
    </div>
  );
}