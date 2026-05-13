import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  KeyRound,
  Package,
  RefreshCw,
  Server,
  Users,
  WalletCards,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAdminMetrics } from '@/lib/adminApi';
import { cn } from '@/lib/utils';

const numberFormat = new Intl.NumberFormat('ru-RU');

function formatNumber(value) {
  return numberFormat.format(Number(value || 0));
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '0 Б';
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return 'нет данных';
  return new Date(value).toLocaleString('ru-RU');
}

const MetricCard = ({ icon: Icon, label, value, description, tone = 'default', progress = undefined }) => {
  const toneClass = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
  }[tone];

  return (
    <Card className="p-4 border-border shadow-warm-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-2 leading-none">{value}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0', toneClass)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {progress !== undefined && (
        <Progress value={Math.min(100, Math.max(0, Number(progress || 0)))} className="h-1.5 mt-4" />
      )}
      {description && (
        <p className="text-xs text-muted-foreground mt-3">{description}</p>
      )}
    </Card>
  );
};

export default function AdminOverview() {
  const {
    data: metrics,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: getAdminMetrics,
    refetchInterval: 30_000,
  });

  if (error) {
    return (
      <Card className="p-6 border-destructive/30 bg-destructive/5">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="font-semibold">Не удалось загрузить метрики</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {error?.message || 'Проверьте доступность backend API.'}
        </p>
      </Card>
    );
  }

  const queue = metrics?.collectionQueue || {};
  const bull = queue.bull || {};
  const queuePending = Math.max(queue.queued || 0, (bull.waiting || 0) + (bull.delayed || 0));
  const system = metrics?.system || {};
  const maxLoad = metrics?.maxLoad || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Операционный обзор</h2>
          <p className="text-sm text-muted-foreground">
            Последнее обновление: {formatDate(metrics?.sampledAt)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2 self-start sm:self-auto">
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          Обновить
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          icon={Cpu}
          label="CPU API"
          value={`${formatNumber(system.cpuLoadPct)}%`}
          description={`Uptime: ${formatNumber(system.uptimeSeconds)} сек.`}
          progress={system.cpuLoadPct}
          tone={system.cpuLoadPct > 80 ? 'danger' : system.cpuLoadPct > 60 ? 'warning' : 'blue'}
        />
        <MetricCard
          icon={Server}
          label="RAM API"
          value={`${formatNumber(system.memoryLoadPct)}%`}
          description={`${formatBytes(system.memoryUsedBytes)} из ${formatBytes(system.memoryLimitBytes)}`}
          progress={system.memoryLoadPct}
          tone={system.memoryLoadPct > 80 ? 'danger' : system.memoryLoadPct > 60 ? 'warning' : 'success'}
        />
        <MetricCard
          icon={HardDrive}
          label="База данных"
          value={formatBytes(metrics?.database?.sizeBytes)}
          description="Занято на диске Postgres"
          tone="violet"
        />
        <MetricCard
          icon={Gauge}
          label="Макс. нагрузка"
          value={`${formatNumber(maxLoad.cpuLoadPct)}%`}
          description={`Зафиксировано: ${formatDate(maxLoad.recordedAt)}`}
          progress={maxLoad.cpuLoadPct}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          icon={Clock}
          label="Очередь сбора"
          value={formatNumber(queuePending)}
          description={`Running: ${formatNumber((queue.running || 0) + (bull.active || 0))} · Failed: ${formatNumber((queue.failed || 0) + (bull.failed || 0))}`}
          tone={queuePending > 0 ? 'warning' : 'success'}
        />
        <MetricCard
          icon={Users}
          label="Пользователи"
          value={formatNumber(metrics?.users?.registered)}
          description={`Онлайн за ${metrics?.traffic?.onlineWindowMinutes || 5} мин.: ${formatNumber(metrics?.users?.online)}`}
          tone="blue"
        />
        <MetricCard
          icon={WalletCards}
          label="Оплаченные аккаунты"
          value={formatNumber(metrics?.subscriptions?.paidTotal)}
          description={`Активных: ${formatNumber(metrics?.subscriptions?.paidActive)}`}
          tone="success"
        />
        <MetricCard
          icon={Package}
          label="Товары в БД"
          value={formatNumber(metrics?.products?.total)}
          description="Все сохраненные товары"
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          icon={KeyRound}
          label="Аккаунты с токеном"
          value={formatNumber(metrics?.products?.accountsWithTokens)}
          description="Клиенты с WB API token"
          tone="warning"
        />
        <MetricCard
          icon={Activity}
          label="Посещаемость сегодня"
          value={formatNumber(metrics?.traffic?.today)}
          description="Уникальные авторизованные пользователи"
          tone="blue"
        />
        <MetricCard
          icon={Activity}
          label="Посещаемость за неделю"
          value={formatNumber(metrics?.traffic?.week)}
          description="Последние 7 дней"
          tone="success"
        />
        <MetricCard
          icon={Activity}
          label="Посещаемость за месяц"
          value={formatNumber(metrics?.traffic?.month)}
          description="Последние 30 дней"
          tone="violet"
        />
      </div>

      <Card className="p-4 border-border shadow-warm-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Детали очереди сбора данных</h3>
          {bull.unavailable && (
            <Badge variant="outline" className="text-warning border-warning/40">
              BullMQ недоступна
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-sm">
          <div>
            <span className="text-muted-foreground">Queued DB</span>
            <p className="font-bold text-foreground">{formatNumber(queue.queued)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Waiting BullMQ</span>
            <p className="font-bold text-foreground">{formatNumber(bull.waiting)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Delayed</span>
            <p className="font-bold text-foreground">{formatNumber(bull.delayed)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Running</span>
            <p className="font-bold text-foreground">{formatNumber((queue.running || 0) + (bull.active || 0))}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Completed</span>
            <p className="font-bold text-foreground">{formatNumber((queue.done || 0) + (bull.completed || 0))}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
