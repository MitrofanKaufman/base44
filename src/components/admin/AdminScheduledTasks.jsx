import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { listScheduledTasks, runScheduledTask } from '@/lib/adminApi';
import { AlertCircle, CalendarClock, CheckCircle2, Clock, Play, RefreshCw } from 'lucide-react';

const statusTone = {
  success: 'text-success',
  skipped: 'text-warning',
  failed: 'text-destructive',
  running: 'text-primary',
  active: 'text-success',
  paused: 'text-warning',
  disabled: 'text-muted-foreground',
  idle: 'text-muted-foreground',
};

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('ru-RU') : '-';
}

function statusLabel(status) {
  if (status === 'success') return 'Успешно';
  if (status === 'skipped') return 'Пропущено';
  if (status === 'failed') return 'Ошибка';
  if (status === 'running') return 'Выполняется';
  if (status === 'active') return 'Активно';
  if (status === 'paused') return 'Пауза';
  if (status === 'disabled') return 'Отключено';
  return 'Ожидает';
}

function TaskStatusIcon({ status }) {
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-success" />;
  if (status === 'failed') return <AlertCircle className="w-4 h-4 text-destructive" />;
  if (status === 'running') return <RefreshCw className="w-4 h-4 text-primary animate-spin" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

export default function AdminScheduledTasks() {
  const queryClient = useQueryClient();
  const { data = { items: [] }, isFetching, error } = useQuery({
    queryKey: ['scheduled-tasks'],
    queryFn: listScheduledTasks,
    refetchInterval: 30_000,
  });
  const runTaskMutation = useMutation({
    mutationFn: runScheduledTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-tasks'] });
    },
  });
  const runningTaskId = runTaskMutation.variables;
  const tasks = data.items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Расписанные задачи</h2>
          <p className="text-sm text-muted-foreground">Серверные задания worker-процесса без браузерных таймеров.</p>
        </div>
        {isFetching && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
      </div>

      {error && (
        <Card className="p-4 border-destructive/30 bg-destructive/5 text-sm text-destructive">
          {error?.message || 'Не удалось загрузить расписанные задачи'}
        </Card>
      )}

      <div className="grid gap-3">
        {tasks.map(task => {
          const isRunning = runTaskMutation.isPending && runningTaskId === task.id;
          const status = isRunning ? 'running' : (task.last_status || task.status);

          return (
            <Card key={task.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-md bg-secondary text-muted-foreground flex items-center justify-center flex-shrink-0">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-sm text-foreground">{task.name}</h3>
                    <span className={`text-xs font-semibold ${statusTone[status] || statusTone.idle}`}>
                      {statusLabel(status)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs text-muted-foreground">
                    <span>Расписание: {task.cadence}</span>
                    <span>Следующий запуск: {formatDate(task.next_run_at)}</span>
                    <span>Последний запуск: {formatDate(task.last_run_at)}</span>
                  </div>
                  {task.last_error && (
                    <p className="text-xs text-destructive mt-2">{task.last_error}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <TaskStatusIcon status={status} />
                <Button
                  onClick={() => runTaskMutation.mutate(task.id)}
                  disabled={runTaskMutation.isPending || status === 'running'}
                  size="sm"
                  variant={status === 'failed' ? 'destructive' : 'outline'}
                  className="gap-2"
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Выполняется
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      Запустить
                    </>
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 bg-secondary/30 border-border/50">
        <h4 className="font-semibold text-sm mb-2">О расписанных задачах</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>Задачи выполняются в backend worker по UTC-расписанию.</li>
          <li>Ручной запуск использует те же серверные обработчики, что и автоматический запуск.</li>
          <li>Ошибки и результаты последнего запуска хранятся в PostgreSQL.</li>
        </ul>
      </Card>
    </div>
  );
}
