import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertCircle, TrendingDown, DollarSign, Package, X } from 'lucide-react';
import { useState } from 'react';

export default function CriticalAlertsWidget() {
  const { data: calculations = [] } = useQuery({
    queryKey: ['calculations'],
    queryFn: () => base44.entities.Calculation.list('-updated_date', 50),
  });

  const { data: priceHistory = [] } = useQuery({
    queryKey: ['priceHistory'],
    queryFn: () => base44.entities.PriceHistory.list('-date', 100),
  });

  const [dismissed, setDismissed] = useState(new Set());

  // Алерты: убыточные товары
  const unprofitableAlerts = calculations
    .filter(c => c.is_profitable === false && !dismissed.has(`calc-${c.id}`))
    .slice(0, 3)
    .map(c => ({
      id: `calc-${c.id}`,
      type: 'unprofitable',
      icon: TrendingDown,
      title: 'Убыточный товар',
      desc: c.name || 'N/A',
      severity: 'critical',
    }));

  // Алерты: критическое падение маржи
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  const marginDrops = [];
  const grouped = {};
  priceHistory
    .filter(ph => new Date(ph.date) >= lastWeek)
    .forEach(ph => {
      if (!grouped[ph.product_id]) grouped[ph.product_id] = [];
      grouped[ph.product_id].push(ph);
    });

  Object.entries(grouped).forEach(([productId, items]) => {
    if (items.length < 2) return;
    const sorted = items.sort((a, b) => new Date(a.date) - new Date(b.date));
    const first = sorted[0].margin_pct || 0;
    const last = sorted[sorted.length - 1].margin_pct || 0;
    const drop = first - last;

    if (drop > 10 && !dismissed.has(`margin-${productId}`)) {
      marginDrops.push({
        id: `margin-${productId}`,
        type: 'margin_drop',
        icon: DollarSign,
        title: 'Критическое падение маржи',
        desc: `SKU ${productId?.substring(0, 8)}: -${drop.toFixed(1)}%`,
        severity: 'warning',
      });
    }
  });

  // Алерты: высокое конкурентное давление
  const priceAlerts = [];
  const latestByProduct = {};
  priceHistory.forEach(ph => {
    if (!latestByProduct[ph.product_id] || new Date(ph.date) > new Date(latestByProduct[ph.product_id].date)) {
      latestByProduct[ph.product_id] = ph;
    }
  });

  Object.values(latestByProduct).forEach(ph => {
    if (ph.competitors && ph.competitors.length > 0) {
      const avgComp = ph.competitors.reduce((s, c) => s + (c.price || 0), 0) / ph.competitors.length;
      const priceDiff = ((ph.our_price || 0) - avgComp) / avgComp * 100;

      if (priceDiff > 15 && !dismissed.has(`price-${ph.product_id}`)) {
        priceAlerts.push({
          id: `price-${ph.product_id}`,
          type: 'price_competition',
          icon: Package,
          title: 'Высокая цена vs конкуренты',
          desc: `SKU ${ph.product_id?.substring(0, 8)}: +${priceDiff.toFixed(0)}% выше среднего`,
          severity: 'info',
        });
      }
    }
  });

  const allAlerts = [...unprofitableAlerts, ...marginDrops, ...priceAlerts].slice(0, 5);

  if (allAlerts.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-6 shadow-warm-sm text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-success/10 mb-3">
          <AlertCircle className="w-5 h-5 text-success" />
        </div>
        <p className="text-sm font-medium text-foreground">Критических алертов нет</p>
        <p className="text-xs text-muted-foreground mt-1">Все ключевые показатели в норме</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6 shadow-warm-sm">
      <div className="flex items-center gap-2 mb-5">
        <AlertCircle className="w-4 h-4 text-destructive" />
        <h2 className="text-sm font-semibold text-foreground">Критические изменения ({allAlerts.length})</h2>
      </div>
      <div className="space-y-3">
        {allAlerts.map(alert => {
          const Icon = alert.icon;
          const bgColor =
            alert.severity === 'critical' ? 'bg-destructive/10' :
            alert.severity === 'warning' ? 'bg-warning/10' :
            'bg-primary/10';
          const textColor =
            alert.severity === 'critical' ? 'text-destructive' :
            alert.severity === 'warning' ? 'text-warning' :
            'text-primary';
          const borderColor =
            alert.severity === 'critical' ? 'border-destructive/20' :
            alert.severity === 'warning' ? 'border-warning/20' :
            'border-primary/20';

          return (
            <div key={alert.id} className={`flex gap-3 p-3 rounded-lg border ${bgColor} ${borderColor}`}>
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${textColor}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${textColor}`}>{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{alert.desc}</p>
              </div>
              <button
                onClick={() => setDismissed(d => new Set([...d, alert.id]))}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}