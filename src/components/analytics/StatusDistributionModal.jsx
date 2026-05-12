import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function StatusDistributionModal({ isOpen, onClose, data }) {
  const [modalData, setModalData] = useState([]);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const dailyStats = {};
    data.forEach(run => {
      const date = new Date(run.startedAt).toLocaleDateString('ru-RU');
      if (!dailyStats[date]) {
        dailyStats[date] = { completed: 0, failed: 0, running: 0, queued: 0, cancelled: 0, partial: 0 };
      }
      dailyStats[date][run.status] = (dailyStats[date][run.status] || 0) + 1;
    });

    const chartData = Object.entries(dailyStats)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, stats]) => ({
        date,
        ...stats,
      }));

    setModalData(chartData);
  }, [data]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Статус прогонов по дням</DialogTitle>
          <DialogDescription>Распределение статусов выполнения прогонов</DialogDescription>
        </DialogHeader>
        <div className="w-full h-96">
          {modalData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modalData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Bar dataKey="completed" fill="hsl(var(--success))" name="Завершено" radius={[8, 8, 0, 0]} />
                <Bar dataKey="failed" fill="hsl(var(--destructive))" name="Ошибка" radius={[8, 8, 0, 0]} />
                <Bar dataKey="running" fill="hsl(var(--primary))" name="Выполняется" radius={[8, 8, 0, 0]} />
                <Bar dataKey="queued" fill="hsl(var(--muted-foreground))" name="В очереди" radius={[8, 8, 0, 0]} />
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
