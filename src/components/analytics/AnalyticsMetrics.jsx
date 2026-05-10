import { TrendingUp, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const MetricCard = ({ icon: Icon, label, value, trend, color = 'text-foreground' }) => (
  <Card className="flex-1">
    <CardContent className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {trend && (
            <p className={`text-xs mt-2 ${trend > 0 ? 'text-success' : trend < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend).toFixed(1)}% vs. вчера
            </p>
          )}
        </div>
        <div className="p-2 rounded-lg bg-secondary/50">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function AnalyticsMetrics({ metrics }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard
        icon={CheckCircle2}
        label="Всего обработано"
        value={metrics?.totalEvents || 0}
        trend={metrics?.eventsTrend}
        color="text-success"
      />
      <MetricCard
        icon={AlertCircle}
        label="Всего ошибок"
        value={metrics?.totalErrors || 0}
        trend={metrics?.errorsTrend}
        color="text-destructive"
      />
      <MetricCard
        icon={TrendingUp}
        label="Средний % ошибок"
        value={`${(metrics?.avgErrorRate || 0).toFixed(2)}%`}
        trend={metrics?.errorRateTrend}
        color="text-warning"
      />
      <MetricCard
        icon={Clock}
        label="Среднее время (сек)"
        value={(metrics?.avgExecutionTime || 0).toFixed(2)}
        trend={metrics?.executionTimeTrend}
      />
    </div>
  );
}