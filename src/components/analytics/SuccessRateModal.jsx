import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function SuccessRateModal({ isOpen, onClose, data }) {
  const [modalData, setModalData] = useState([]);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const dailyStats = {};
    data.forEach(run => {
      const date = new Date(run.startedAt).toLocaleDateString('ru-RU');
      if (!dailyStats[date]) {
        dailyStats[date] = { completed: 0, failed: 0, total: 0 };
      }
      dailyStats[date].total += 1;
      if (run.status === 'completed') dailyStats[date].completed += 1;
      else if (run.status === 'failed') dailyStats[date].failed += 1;
    });

    const chartData = Object.entries(dailyStats)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, stats]) => ({
        date,
        successRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
        completed: stats.completed,
        failed: stats.failed,
        total: stats.total,
      }));

    setModalData(chartData);
  }, [data]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Процент успешности по дням</DialogTitle>
          <DialogDescription>Доля успешно завершённых прогонов (%)</DialogDescription>
        </DialogHeader>
        <div className="w-full h-96">
          {modalData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value) => Number(value).toFixed(2)}
                  labelFormatter={(label) => `Дата: ${label}`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="successRate" fill="hsl(var(--success))" name="Процент успешности" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">Нет данных</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
