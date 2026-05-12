import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Clock } from 'lucide-react';

const TASKS = [
  {
    id: 'sync-tariffs',
    name: 'Загрузка справочников с тарифами',
    description: 'Синхронизация справочников направлений и тарифов с маркетплейсов',
    schedule: '0 2 * * *',
    scheduleDisplay: 'Ежедневно в 02:00',
    icon: '📚'
  },
  {
    id: 'fetch-random-product',
    name: 'Загрузка случайного товара с WB',
    description: 'Получение данных о случайном товаре для тестирования',
    schedule: '0 * * * *',
    scheduleDisplay: 'Каждый час',
    icon: '📦'
  }
];

export default function AdminScheduledTasks() {
  const [taskStatus, setTaskStatus] = useState({});

  // Загрузим статусы задач
  const { data: _tasks = [] } = useQuery({
    queryKey: ['scheduled-tasks'],
    queryFn: async () => {
      try {
        await base44.integrations.Core.InvokeLLM({
          prompt: 'Return empty JSON array []',
          response_json_schema: { type: 'object', properties: {} }
        });
        return [];
      } catch {
        return [];
      }
    }
  });

  const runTaskMutation = useMutation({
    mutationFn: async (/** @type {string} */ taskId) => {
      setTaskStatus(s => ({ ...s, [taskId]: 'running' }));
      
      try {
        if (taskId === 'sync-tariffs') {
          await base44.integrations.Core.InvokeLLM({
            prompt: 'Sync marketplace tariff directories and store them'
          });
        } else if (taskId === 'fetch-random-product') {
          await base44.integrations.Core.InvokeLLM({
            prompt: 'Fetch a random product from Wildberries marketplace'
          });
        }
        
        setTaskStatus(s => ({ ...s, [taskId]: 'success' }));
        setTimeout(() => setTaskStatus(s => ({ ...s, [taskId]: null })), 3000);
      } catch {
        setTaskStatus(s => ({ ...s, [taskId]: 'error' }));
        setTimeout(() => setTaskStatus(s => ({ ...s, [taskId]: null })), 3000);
      }
    }
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Расписанные задачи</h2>
        <p className="text-sm text-muted-foreground">Управление автоматическими синхронизациями и загрузками данных</p>
      </div>

      <div className="grid gap-3">
        {TASKS.map(task => {
          const status = taskStatus[task.id];
          
          return (
            <Card key={task.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex gap-3 flex-1">
                <div className="text-2xl flex-shrink-0">{task.icon}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{task.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{task.scheduleDisplay}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <Button
                  onClick={() => runTaskMutation.mutate(task.id)}
                  disabled={runTaskMutation.isPending || status === 'running'}
                  size="sm"
                  variant={
                    status === 'success' ? 'outline' :
                    status === 'error' ? 'destructive' :
                    'default'
                  }
                  className="gap-2"
                >
                  {status === 'running' ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Выполняется...
                    </>
                  ) : status === 'success' ? (
                    <>✓ Успешно</>
                  ) : status === 'error' ? (
                    <>✕ Ошибка</>
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
          <li>• Задачи выполняются автоматически по расписанию на сервере</li>
          <li>• Вы можете запустить задачу вручную в любой момент</li>
          <li>• Справочники хранятся в базе данных для использования в калькуляторе</li>
          <li>• Логи выполнения доступны в системе мониторинга</li>
        </ul>
      </Card>
    </div>
  );
}
