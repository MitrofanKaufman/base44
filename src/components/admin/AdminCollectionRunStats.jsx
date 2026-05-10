import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function AdminCollectionRunStats() {
  const { data: allRuns = [] } = useQuery({
    queryKey: ['ingestion-runs-all'],
    queryFn: async () => {
      try {
        return await base44.entities.IngestionRun.list('-created_date', 100);
      } catch {
        return [];
      }
    },
  });

  const chartData = useMemo(() => {
    if (!allRuns.length) return [];

    // Группируем прогоны по дням
    const grouped = {};
    allRuns.forEach(run => {
      if (!run.created_date) return;
      const date = new Date(run.created_date).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      if (!grouped[date]) {
        grouped[date] = { completed: 0, failed: 0, cancelled: 0, partial: 0 };
      }

      if (run.status === 'completed') grouped[date].completed++;
      else if (run.status === 'failed') grouped[date].failed++;
      else if (run.status === 'cancelled') grouped[date].cancelled++;
      else if (run.status === 'partial') grouped[date].partial++;
    });

    // Сортируем по дате и преобразуем в массив
    return Object.entries(grouped)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .slice(-14) // Последние 14 дней
      .map(([date, counts]) => ({
        date,
        success: counts.completed,
        failed: counts.failed,
        cancelled: counts.cancelled,
        partial: counts.partial,
        total: counts.completed + counts.failed + counts.cancelled + counts.partial,
      }));
  }, [allRuns]);

  const stats = useMemo(() => {
    const total = allRuns.length;
    const completed = allRuns.filter(r => r.status === 'completed').length;
    const failed = allRuns.filter(r => r.status === 'failed').length;
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    return { total, completed, failed, successRate };
  }, [allRuns]);

  if (chartData.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg">Статистика прогонов</h3>
        </div>
        <p className="text-muted-foreground">Нет данных для отображения. Запустите несколько прогонов.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Карточки с основной статистикой */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Всего прогонов</p>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Успешных</p>
          <p className="text-2xl font-bold text-success">{stats.completed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Ошибок</p>
          <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Успешность</p>
          <p className="text-2xl font-bold text-primary">{stats.successRate}%</p>
        </Card>
      </div>

      {/* График статуса по дням */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-base">Статус прогонов по дням</h3>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" style={{ fontSize: '12px' }} />
            <YAxis style={{ fontSize: '12px' }} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
            <Legend />
            <Bar dataKey="success" stackId="status" fill="#10b981" name="Успешно" />
            <Bar dataKey="failed" stackId="status" fill="#ef4444" name="Ошибки" />
            <Bar dataKey="cancelled" stackId="status" fill="#f59e0b" name="Отменено" />
            <Bar dataKey="partial" stackId="status" fill="#8b5cf6" name="Частично" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* График успешности */}
      <Card className="p-4">
        <h3 className="font-bold text-base mb-4">Процент успешности по дням</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" style={{ fontSize: '12px' }} />
            <YAxis domain={[0, 100]} style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              formatter={(value, name, props) => {
                if (name === 'successRate') {
                  const rate = props.payload.success > 0 ? ((props.payload.success / props.payload.total) * 100).toFixed(1) : 0;
                  return [rate + '%', 'Успешность'];
                }
              }}
              labelFormatter={(label) => `Дата: ${label}`}
            />
            <Line
              type="monotone"
              dataKey={(d) => {
                return d.success > 0 ? ((d.success / d.total) * 100).toFixed(1) : 0;
              }}
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Успешность (%)"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}