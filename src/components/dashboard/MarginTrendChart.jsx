import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function MarginTrendChart() {
  const { data: priceHistory = [] } = useQuery({
    queryKey: ['priceHistory'],
    queryFn: () => base44.entities.PriceHistory.list('-date', 100),
  });

  // Группируем по датам за последнюю неделю
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  const grouped = {};
  priceHistory
    .filter(ph => new Date(ph.date) >= lastWeek)
    .forEach(ph => {
      const date = new Date(ph.date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(ph);
    });

  const chartData = Object.entries(grouped)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([date, items]) => ({
      date,
      avgMargin: items.reduce((s, i) => s + (i.margin_pct || 0), 0) / items.length || 0,
      count: items.length,
    }));

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6 shadow-warm-sm">
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Динамика маржи за неделю</h2>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              fontSize: 12,
              boxShadow: '0 8px 24px rgba(61,38,20,.10)',
            }}
            formatter={(value) => `${Number(value).toFixed(1)}%`}
            labelFormatter={(label) => `Дата: ${label}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="avgMargin"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', r: 4 }}
            activeDot={{ r: 6 }}
            name="Средняя маржа"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
