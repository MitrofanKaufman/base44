import { ReceiptText } from 'lucide-react';
import { calculateWbReportMetrics, formatNum, formatPct, formatRub } from '@/lib/unitEconomics';

const money = (value) => value === undefined ? '—' : formatRub(value);
const pct = (value) => value === undefined ? '—' : formatPct(value, 'ratio');
const num = (value, suffix = '') => value === undefined ? '—' : `${formatNum(value)}${suffix}`;

const Row = ({ label, value, formula }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-border/40 py-1.5 last:border-0">
    <div className="min-w-0">
      <p className="truncate text-[11px] font-medium text-foreground">{label}</p>
      <p className="truncate text-[9px] text-muted-foreground">{formula}</p>
    </div>
    <span className="self-center whitespace-nowrap text-[12px] font-bold text-foreground">{value}</span>
  </div>
);

export default function WbReportPanel({ form }) {
  const metrics = calculateWbReportMetrics(form);

  const rows = [
    ['Выручка', money(metrics.revenue), 'Продажи − Возврат'],
    ['Ср. цена продажи', money(metrics.avgSalePrice), 'Продажи / Итого продаж шт.'],
    ['Выкуп', pct(metrics.buyoutPct), 'Продаж шт. / (Продаж шт. + Отмены и невыкупы)'],
    ['Комиссия', pct(metrics.commissionPct), 'Комиссия руб / Выручка'],
    ['Эквайринг', pct(metrics.acquiringPct), 'Эквайринг руб / Выручка'],
    ['Итого логистика', money(metrics.totalLogistics), 'Логистика доставок + Логистика возвратов'],
    ['Логистика от выручки', pct(metrics.logisticsRevenuePct), 'Итого логистика / Выручка'],
    ['Все удержания WB', money(metrics.wbDeductions), 'Выручка − Оплата на Р/С'],
    ['Налоговая база', money(metrics.taxBase), 'WB реализовал'],
    ['Сумма налога', money(metrics.taxAmount), 'Налоговая база × Ставка налога'],
    ['Чистая прибыль', money(metrics.netProfit), 'Оплата на Р/С − Налог − Себестоимость'],
    ['Прибыль на ед.', money(metrics.profitPerUnit), 'Чистая прибыль / Итого продаж шт.'],
    ['Доля прибыли', pct(metrics.profitSharePct), 'Чистая прибыль всего / Чистая прибыль артикула'],
    ['Маржинальность по прибыли', pct(metrics.profitMarginPct), 'Чистая прибыль / Выручка'],
    ['Рентабельность', pct(metrics.profitabilityPct), 'Чистая прибыль / Себестоимость'],
  ];

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm p-4">
      <div className="mb-3 flex items-center gap-2">
        <ReceiptText className="h-4 w-4 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">WB отчёт по формулам</span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-md bg-secondary/40 p-2 text-center">
          <p className="text-[9px] text-muted-foreground">Продаж</p>
          <p className="text-sm font-bold">{num(metrics.soldUnits, ' шт.')}</p>
        </div>
        <div className="rounded-md bg-secondary/40 p-2 text-center">
          <p className="text-[9px] text-muted-foreground">Возврат</p>
          <p className="text-sm font-bold">{money(metrics.returnsRub)}</p>
        </div>
        <div className="rounded-md bg-secondary/40 p-2 text-center">
          <p className="text-[9px] text-muted-foreground">К выплате</p>
          <p className="text-sm font-bold">{money(metrics.payoutRub)}</p>
        </div>
      </div>

      <div className="space-y-0">
        {rows.map(([label, value, formula]) => (
          <Row key={label} label={label} value={value} formula={formula} />
        ))}
      </div>
    </div>
  );
}
