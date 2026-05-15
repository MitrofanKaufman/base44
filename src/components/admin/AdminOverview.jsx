import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  KeyRound,
  MailPlus,
  Package,
  RefreshCw,
  Server,
  Shield,
  Users,
  WalletCards,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminDashboardGrid from '@/components/admin/AdminDashboardGrid';
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

function getToneClass(tone) {
  return {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
  }[tone] || 'bg-slate-100 text-slate-700';
}

const ModulePanel = ({ icon: Icon, title, description = '', badge = null, children, actions = [] }) => (
  <Card className="p-4 border-border shadow-warm-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{title}</h3>
            {badge}
          </div>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
      </div>
    </div>
    <div className="mt-4">
      {children}
    </div>
    {actions?.length > 0 && (
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/70">
        {actions.map(action => (
          action.to ? (
            <Button key={action.label} asChild size="sm" variant={action.variant || 'outline'} className="gap-1">
              <Link to={action.to}>
                {action.label}
                <ArrowRight className="w-3 h-3" />
              </Link>
            </Button>
          ) : (
            <Button
              key={action.label}
              type="button"
              size="sm"
              variant={action.variant || 'outline'}
              onClick={action.onClick}
              className="gap-1"
            >
              {action.label}
              <ArrowRight className="w-3 h-3" />
            </Button>
          )
        ))}
      </div>
    )}
  </Card>
);

const StatTile = ({
  icon: Icon,
  label,
  value,
  description = '',
  tone = 'default',
  progress = undefined,
  onClick = undefined,
  to = undefined,
  className = '',
}) => {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-2 leading-none">{value}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0', getToneClass(tone))}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {progress !== undefined && (
        <Progress value={Math.min(100, Math.max(0, Number(progress || 0)))} className="h-1.5 mt-4" />
      )}
      {description && (
        <p className="text-xs text-muted-foreground mt-3">{description}</p>
      )}
      {(onClick || to) && (
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
          Подробнее
          <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </>
  );

  const tileClassName = cn(
    'rounded-lg border border-border/70 bg-card/70 p-4 text-left transition-colors',
    (onClick || to) && 'hover:border-primary/50 hover:bg-primary/5',
    className,
  );

  if (to) {
    return <Link to={to} className={tileClassName}>{body}</Link>;
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={tileClassName}>
        {body}
      </button>
    );
  }

  return <div className={tileClassName}>{body}</div>;
};

const DetailRow = ({ label, value, tone = 'default' }) => (
  <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className={cn('text-sm font-semibold', {
      'text-foreground': tone === 'default',
      'text-success': tone === 'success',
      'text-warning': tone === 'warning',
      'text-destructive': tone === 'danger',
    })}>
      {value}
    </span>
  </div>
);

const noopSelectSection = (_section) => {};

export default function AdminOverview({ onSelectSection = noopSelectSection }) {
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
  const runningJobs = (queue.running || 0) + (bull.active || 0);
  const failedJobs = (queue.failed || 0) + (bull.failed || 0);
  const completedJobs = (queue.done || 0) + (bull.completed || 0);
  const system = metrics?.system || {};
  const maxLoad = metrics?.maxLoad || {};
  const cpuTone = system.cpuLoadPct > 80 ? 'danger' : system.cpuLoadPct > 60 ? 'warning' : 'blue';
  const memoryTone = system.memoryLoadPct > 80 ? 'danger' : system.memoryLoadPct > 60 ? 'warning' : 'success';
  const alerts = metrics?.alerts || [];
  const workers = metrics?.workers || {};
  const workerItems = workers.items || [];

  const dashboardBlocks = [
    {
      id: 'infrastructure',
      title: 'Инфраструктура',
      defaultSpan: 2,
      children: (
        <ModulePanel
          icon={Server}
          title="Инфраструктура"
          description="Нагрузка API, память, размер PostgreSQL и максимальный зафиксированный пик."
          badge={<Badge variant="outline">API process</Badge>}
          actions={[
            { label: 'API', onClick: () => onSelectSection('swagger') },
            { label: 'Raw Frames', onClick: () => onSelectSection('raw-frames') },
            { label: 'Снимки', onClick: () => onSelectSection('snapshots') },
          ]}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatTile
              icon={Cpu}
              label="CPU"
              value={`${formatNumber(system.cpuLoadPct)}%`}
              description={`Uptime: ${formatNumber(system.uptimeSeconds)} сек.`}
              progress={system.cpuLoadPct}
              tone={cpuTone}
              onClick={() => onSelectSection('swagger')}
            />
            <StatTile
              icon={Server}
              label="RAM"
              value={`${formatNumber(system.memoryLoadPct)}%`}
              description={`${formatBytes(system.memoryUsedBytes)} из ${formatBytes(system.memoryLimitBytes)}`}
              progress={system.memoryLoadPct}
              tone={memoryTone}
              onClick={() => onSelectSection('swagger')}
            />
            <StatTile
              icon={HardDrive}
              label="База данных"
              value={formatBytes(metrics?.database?.sizeBytes)}
              description="Занято на диске Postgres"
              tone="violet"
              onClick={() => onSelectSection('raw-frames')}
            />
            <StatTile
              icon={Gauge}
              label="Пик нагрузки"
              value={`${formatNumber(maxLoad.cpuLoadPct)}%`}
              description={`Зафиксировано: ${formatDate(maxLoad.recordedAt)}`}
              progress={maxLoad.cpuLoadPct}
              tone="warning"
              onClick={() => onSelectSection('swagger')}
            />
          </div>
        </ModulePanel>
      ),
    },
    {
      id: 'collection',
      title: 'Сбор данных',
      defaultSpan: 2,
      children: (
        <ModulePanel
          icon={Clock}
          title="Сбор данных"
          description="Очередь Wildberries, активные задачи, ошибки и связанные списки данных."
          badge={bull.unavailable ? <Badge variant="outline" className="text-warning border-warning/40">BullMQ недоступна</Badge> : <Badge variant="secondary">BullMQ</Badge>}
          actions={[
            { label: 'Прогон сбора', onClick: () => onSelectSection('collection-runner'), variant: 'default' },
            { label: 'Ошибки', onClick: () => onSelectSection('dead-letters') },
            { label: 'События', onClick: () => onSelectSection('events') },
            { label: 'Товары', to: '/products' },
          ]}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatTile
              icon={Clock}
              label="Ожидают сбора"
              value={formatNumber(queuePending)}
              description={`DB queued: ${formatNumber(queue.queued)} · Bull waiting: ${formatNumber(bull.waiting)}`}
              tone={queuePending > 0 ? 'warning' : 'success'}
              onClick={() => onSelectSection('collection-runner')}
            />
            <StatTile
              icon={Package}
              label="Товары"
              value={formatNumber(metrics?.products?.total)}
              description="Все сохраненные товары в БД"
              tone="violet"
              to="/products"
            />
            <StatTile
              icon={KeyRound}
              label="Аккаунты с токеном"
              value={formatNumber(metrics?.products?.accountsWithTokens)}
              description="Клиенты с WB API token"
              tone="warning"
              onClick={() => onSelectSection('wb-sync')}
            />
            <div className="space-y-2">
              <DetailRow label="Выполняются" value={formatNumber(runningJobs)} tone={runningJobs > 0 ? 'warning' : 'default'} />
              <DetailRow label="Ошибки" value={formatNumber(failedJobs)} tone={failedJobs > 0 ? 'danger' : 'default'} />
              <DetailRow label="Завершены" value={formatNumber(completedJobs)} tone="success" />
              <DetailRow label="Delayed" value={formatNumber(bull.delayed)} />
              <DetailRow label="Workers" value={`${formatNumber(workers.active)} active / ${formatNumber(workers.stale)} stale`} tone={workers.stale > 0 ? 'warning' : 'success'} />
            </div>
          </div>
        </ModulePanel>
      ),
    },
    {
      id: 'users-access',
      title: 'Пользователи и доступ',
      defaultSpan: 2,
      children: (
        <ModulePanel
          icon={Users}
          title="Пользователи и доступ"
          description="Регистрации, онлайн, оплаченные аккаунты и управление доступом."
          actions={[
            { label: 'Подписки пользователей', onClick: () => onSelectSection('user-subscriptions'), variant: 'default' },
            { label: 'Пакеты', onClick: () => onSelectSection('subscriptions') },
            { label: 'Рассылки', onClick: () => onSelectSection('broadcasts') },
          ]}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatTile
              icon={Users}
              label="Зарегистрированы"
              value={formatNumber(metrics?.users?.registered)}
              description={`Онлайн за ${metrics?.traffic?.onlineWindowMinutes || 5} мин.: ${formatNumber(metrics?.users?.online)}`}
              tone="blue"
              onClick={() => onSelectSection('user-subscriptions')}
            />
            <StatTile
              icon={WalletCards}
              label="Оплаченные"
              value={formatNumber(metrics?.subscriptions?.paidTotal)}
              description={`Активных: ${formatNumber(metrics?.subscriptions?.paidActive)}`}
              tone="success"
              onClick={() => onSelectSection('user-subscriptions')}
            />
            <StatTile
              icon={Shield}
              label="Тарифные записи"
              value={formatNumber(metrics?.subscriptions?.paidRecordsTotal)}
              description="Все пользовательские подписки"
              tone="violet"
              onClick={() => onSelectSection('subscriptions')}
            />
            <StatTile
              icon={MailPlus}
              label="Коммуникации"
              value="Inbox"
              description="Ручные и автоматические рассылки"
              tone="warning"
              onClick={() => onSelectSection('broadcasts')}
            />
          </div>
        </ModulePanel>
      ),
    },
    {
      id: 'traffic',
      title: 'Посещаемость',
      defaultSpan: 2,
      children: (
        <ModulePanel
          icon={Activity}
          title="Посещаемость"
          description="Уникальные авторизованные пользователи по heartbeat-активности."
          actions={[
            { label: 'Рассылки', onClick: () => onSelectSection('broadcasts') },
            { label: 'Подписки', onClick: () => onSelectSection('user-subscriptions') },
          ]}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatTile
              icon={Activity}
              label="Сегодня"
              value={formatNumber(metrics?.traffic?.today)}
              description="С начала дня"
              tone="blue"
              onClick={() => onSelectSection('broadcasts')}
            />
            <StatTile
              icon={Activity}
              label="Неделя"
              value={formatNumber(metrics?.traffic?.week)}
              description="Последние 7 дней"
              tone="success"
              onClick={() => onSelectSection('broadcasts')}
            />
            <StatTile
              icon={Activity}
              label="Месяц"
              value={formatNumber(metrics?.traffic?.month)}
              description="Последние 30 дней"
              tone="violet"
              onClick={() => onSelectSection('broadcasts')}
            />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <DetailRow label="Сейчас онлайн" value={formatNumber(metrics?.users?.online)} tone={metrics?.users?.online > 0 ? 'success' : 'default'} />
            <DetailRow label="Окно онлайн" value={`${metrics?.traffic?.onlineWindowMinutes || 5} мин.`} />
          </div>
        </ModulePanel>
      ),
    },
    {
      id: 'data-links',
      title: 'Быстрые переходы',
      defaultSpan: 'full',
      allowedSpans: [2, 3, 'full'],
      children: (
        <Card className="p-4 border-border shadow-warm-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-md bg-muted text-muted-foreground flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Быстрые переходы к данным</h3>
                <p className="text-sm text-muted-foreground">Откройте список, который объясняет выбранную метрику.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onSelectSection('events')}>События</Button>
              <Button size="sm" variant="outline" onClick={() => onSelectSection('raw-frames')}>Raw Frames</Button>
              <Button size="sm" variant="outline" onClick={() => onSelectSection('snapshots')}>Снимки</Button>
              <Button size="sm" variant="outline" onClick={() => onSelectSection('dead-letters')}>Ошибки</Button>
            </div>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Card className="p-3 border-border shadow-warm-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">Операционный обзор</h2>
            <p className="text-sm text-muted-foreground">
              Последнее обновление: {formatDate(metrics?.sampledAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">API process</Badge>
            <Badge variant={workers.stale > 0 ? 'outline' : 'secondary'} className={workers.stale > 0 ? 'text-warning border-warning/40' : ''}>
              Workers: {formatNumber(workers.active || workerItems.length)}
            </Badge>
            {bull.unavailable ? (
              <Badge variant="outline" className="text-warning border-warning/40">BullMQ недоступна</Badge>
            ) : (
              <Badge variant="secondary">BullMQ</Badge>
            )}
            <Badge variant="outline">Онлайн окно: {metrics?.traffic?.onlineWindowMinutes || 5} мин.</Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
              Обновить
            </Button>
          </div>
        </div>
      </Card>

      {alerts.length > 0 && (
        <Card className="p-4 border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="w-4 h-4" />
            <h3 className="font-semibold text-sm">Операционные алерты</h3>
          </div>
          <div className="mt-3 grid gap-2">
            {alerts.map(alert => (
              <div key={alert.code || alert.message} className="rounded-md border border-border/70 bg-card/70 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{alert.title || alert.code}</span>
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'}>
                    {alert.severity || 'warning'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
      >
        <StatTile
          icon={Cpu}
          label="CPU"
          value={`${formatNumber(system.cpuLoadPct)}%`}
          description="Нагрузка API"
          progress={system.cpuLoadPct}
          tone={cpuTone}
          onClick={() => onSelectSection('swagger')}
          className="min-h-[128px] bg-card"
        />
        <StatTile
          icon={Server}
          label="RAM"
          value={`${formatNumber(system.memoryLoadPct)}%`}
          description={formatBytes(system.memoryUsedBytes)}
          progress={system.memoryLoadPct}
          tone={memoryTone}
          onClick={() => onSelectSection('swagger')}
          className="min-h-[128px] bg-card"
        />
        <StatTile
          icon={Clock}
          label="Очередь"
          value={formatNumber(queuePending)}
          description="Ожидают сбора"
          tone={queuePending > 0 ? 'warning' : 'success'}
          onClick={() => onSelectSection('collection-runner')}
          className="min-h-[128px] bg-card"
        />
        <StatTile
          icon={Users}
          label="Пользователи"
          value={formatNumber(metrics?.users?.registered)}
          description={`Онлайн: ${formatNumber(metrics?.users?.online)}`}
          tone="blue"
          onClick={() => onSelectSection('user-subscriptions')}
          className="min-h-[128px] bg-card"
        />
        <StatTile
          icon={WalletCards}
          label="Оплачены"
          value={formatNumber(metrics?.subscriptions?.paidTotal)}
          description={`Активных: ${formatNumber(metrics?.subscriptions?.paidActive)}`}
          tone="success"
          onClick={() => onSelectSection('user-subscriptions')}
          className="min-h-[128px] bg-card"
        />
        <StatTile
          icon={Package}
          label="Товары"
          value={formatNumber(metrics?.products?.total)}
          description={`Токены: ${formatNumber(metrics?.products?.accountsWithTokens)}`}
          tone="violet"
          to="/products"
          className="min-h-[128px] bg-card"
        />
        <StatTile
          icon={HardDrive}
          label="БД"
          value={formatBytes(metrics?.database?.sizeBytes)}
          description="Занято на диске"
          tone="violet"
          onClick={() => onSelectSection('raw-frames')}
          className="min-h-[128px] bg-card"
        />
        <StatTile
          icon={Gauge}
          label="Пик нагрузки"
          value={`${formatNumber(maxLoad.cpuLoadPct)}%`}
          description={formatDate(maxLoad.recordedAt)}
          progress={maxLoad.cpuLoadPct}
          tone="warning"
          onClick={() => onSelectSection('swagger')}
          className="min-h-[128px] bg-card"
        />
      </div>

      <AdminDashboardGrid
        storageKey="admin-overview-dashboard-layout"
        title="Модули обзора"
        items={dashboardBlocks}
      />
    </div>
  );
}
