import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingDown, Users, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const DEFAULT_THRESHOLDS = {
  minMarginPct: 15,
  maxCompetitorPriceDiffPct: 5
};

export default function AlertsPanel() {
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [expandedAlerts, setExpandedAlerts] = useState({});
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-updated_date', 100),
    refetchInterval: 300000 // 5 минут
  });

  const { data: priceHistories = [] } = useQuery({
    queryKey: ['priceHistories'],
    queryFn: async () => {
      const histories = await base44.entities.PriceHistory.list('-date', 500);
      return histories;
    },
    refetchInterval: 300000
  });

  // Группируем последнюю цену по товарам
  const latestPrices = {};
  priceHistories.forEach(ph => {
    if (!latestPrices[ph.product_id] || new Date(ph.date) > new Date(latestPrices[ph.product_id].date)) {
      latestPrices[ph.product_id] = ph;
    }
  });

  // Генерируем алерты
  const generateAlerts = () => {
    const alerts = [];

    products.forEach(product => {
      const alertId = product.id;
      if (dismissedAlerts.has(alertId)) return;

      // Проверка маржинальности
      if (product.margin_pct !== undefined && product.margin_pct < thresholds.minMarginPct) {
        alerts.push({
          id: `margin-${alertId}`,
          type: 'margin',
          severity: product.margin_pct < thresholds.minMarginPct * 0.5 ? 'critical' : 'warning',
          product,
          message: `Маржинальность упала ниже ${thresholds.minMarginPct}%`,
          value: product.margin_pct,
          threshold: thresholds.minMarginPct
        });
      }

      // Проверка цен конкурентов
      const priceHistory = latestPrices[product.id];
      if (priceHistory?.competitors && Array.isArray(priceHistory.competitors)) {
        priceHistory.competitors.forEach(competitor => {
          const priceDiff = ((competitor.price - priceHistory.our_price) / priceHistory.our_price) * 100;
          if (priceDiff < -thresholds.maxCompetitorPriceDiffPct) {
            alerts.push({
              id: `competitor-${alertId}-${competitor.name}`,
              type: 'competitor',
              severity: priceDiff < -thresholds.maxCompetitorPriceDiffPct * 2 ? 'critical' : 'warning',
              product,
              message: `${competitor.name} дешевле на ${Math.abs(priceDiff).toFixed(1)}%`,
              competitorPrice: competitor.price,
              ourPrice: priceHistory.our_price,
              competitorName: competitor.name,
              priceDiff: Math.abs(priceDiff)
            });
          }
        });
      }
    });

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  };

  const alerts = generateAlerts();

  const dismissAlert = (alertId) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
  };

  const toggleExpanded = (alertId) => {
    setExpandedAlerts(prev => ({
      ...prev,
      [alertId]: !prev[alertId]
    }));
  };

  if (alerts.length === 0) {
    return (
      <div className="bg-card rounded-[18px] border border-border shadow-warm-sm p-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-success" />
          </div>
          <span className="text-sm font-medium text-success">Нет алертов</span>
        </div>
        <p className="text-xs text-muted-foreground">Все товары в норме</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Настройки пороговых значений */}
      <div className="bg-card rounded-[18px] border border-border shadow-warm-sm p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Пороговые значения
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Минимальная маржа</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                value={thresholds.minMarginPct}
                onChange={e => setThresholds({ ...thresholds, minMarginPct: +e.target.value })}
                className="w-16 h-7 px-2 border border-border rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block mb-1">Макс. разница цены</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                value={thresholds.maxCompetitorPriceDiffPct}
                onChange={e => setThresholds({ ...thresholds, maxCompetitorPriceDiffPct: +e.target.value })}
                className="w-16 h-7 px-2 border border-border rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Список алертов */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">
              Активные алерты ({alerts.length})
            </span>
          </div>
        </div>

        {alerts.map(alert => (
          <Card
            key={alert.id}
            className={cn(
              'p-3 cursor-pointer transition-all',
              alert.severity === 'critical'
                ? 'border-destructive/50 bg-destructive/5'
                : 'border-warning/50 bg-warning/5'
            )}
            onClick={() => toggleExpanded(alert.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    alert.severity === 'critical' ? 'bg-destructive' : 'bg-warning'
                  )} />
                  <span className="text-xs font-semibold truncate text-foreground">
                    {alert.product.name}
                  </span>
                  {alert.product.wb_sku && (
                    <span className="text-[9px] font-mono text-muted-foreground flex-shrink-0">
                      {alert.product.wb_sku}
                    </span>
                  )}
                </div>

                <div className="text-xs text-muted-foreground mb-2">
                  {alert.type === 'margin' ? (
                    <div className="flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      <span>
                        Маржа: <strong className="text-foreground">{alert.value?.toFixed(1)}%</strong>
                        {' '}(мин: {alert.threshold}%)
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>
                        {alert.competitorName}: <strong className="text-foreground">{alert.competitorPrice}₽</strong>
                        {' '}(наша: {alert.ourPrice}₽, разница: {alert.priceDiff.toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>

                {expandedAlerts[alert.id] && (
                  <div className="text-[10px] text-muted-foreground bg-secondary/30 rounded p-2 mt-2 space-y-1">
                    <div>Товар: {alert.product.name}</div>
                    {alert.type === 'margin' && (
                      <>
                        <div>Текущая маржа: {alert.value?.toFixed(1)}%</div>
                        <div>Минимальная маржа: {alert.threshold}%</div>
                      </>
                    )}
                    {alert.type === 'competitor' && (
                      <>
                        <div>Наша цена: {alert.ourPrice}₽</div>
                        <div>Цена конкурента: {alert.competitorPrice}₽</div>
                        <div>Разница: {alert.priceDiff.toFixed(1)}%</div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={e => {
                  e.stopPropagation();
                  dismissAlert(alert.id);
                }}
                className="p-1 hover:bg-secondary/50 rounded transition-colors flex-shrink-0"
                title="Закрыть алерт"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}