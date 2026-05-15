import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, RefreshCw, ServerCog, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listScheduledTasks, runScheduledTask } from '@/lib/adminApi';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('ru-RU') : '-';
}

function statusLabel(status) {
  if (status === 'success') return 'Активна';
  if (status === 'skipped') return 'Пропущено';
  if (status === 'failed') return 'Ошибка';
  if (status === 'running') return 'Выполняется';
  if (status === 'active') return 'Активна';
  return 'Ожидает';
}

export default function SyncStatusWidget() {
  const queryClient = useQueryClient();
  const { data = { items: [] }, isFetching } = useQuery({
    queryKey: ['scheduled-tasks'],
    queryFn: listScheduledTasks,
    refetchInterval: 30_000,
  });
  const runMutation = useMutation({
    mutationFn: runScheduledTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-tasks'] });
    },
  });
  const tasks = data.items || [];
  const directoryTask = tasks.find(task => task.id === 'wb-directories-sync');
  const productTask = tasks.find(task => task.id === 'wb-active-products-sync');
  const primaryStatus = runMutation.isPending && runMutation.variables === directoryTask?.id
    ? 'running'
    : directoryTask?.last_status || directoryTask?.status || 'active';
  const isHealthy = ['success', 'active', 'skipped'].includes(primaryStatus);

  return (
    <div className="bg-card rounded-lg border border-border p-6 shadow-warm-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Статус синхронизации WB API</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          isHealthy ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
        }`}>
          {isHealthy ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          {statusLabel(primaryStatus)}
        </div>
      </div>

      <div className="bg-secondary/30 rounded-lg p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Справочники:</span>
          <span className="font-mono text-right">{formatDate(directoryTask?.last_run_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Следующий запуск:</span>
          <span className="font-mono text-right">{formatDate(directoryTask?.next_run_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Товары:</span>
          <span className="font-mono text-right">{formatDate(productTask?.last_run_at)}</span>
        </div>
        {directoryTask?.last_error && (
          <div className="text-destructive pt-1">{directoryTask.last_error}</div>
        )}
      </div>

      <div className="space-y-2">
        <Button
          onClick={() => directoryTask && runMutation.mutate(directoryTask.id)}
          disabled={!directoryTask || runMutation.isPending}
          variant="outline"
          size="sm"
          className="w-full gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${runMutation.isPending && runMutation.variables === directoryTask?.id ? 'animate-spin' : ''}`} />
          Синхронизировать справочники
        </Button>
        <Button
          onClick={() => productTask && runMutation.mutate(productTask.id)}
          disabled={!productTask || runMutation.isPending}
          variant="outline"
          size="sm"
          className="w-full gap-2"
        >
          <ServerCog className={`w-3.5 h-3.5 ${runMutation.isPending && runMutation.variables === productTask?.id ? 'animate-spin' : ''}`} />
          Поставить товары в очередь
        </Button>
      </div>

      {isFetching && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Обновление статуса
        </div>
      )}
    </div>
  );
}
