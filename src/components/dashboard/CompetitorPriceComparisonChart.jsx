import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Zap } from 'lucide-react';
import { formatRub } from '@/lib/unitEconomics';

export default function CompetitorPriceComparisonChart() {
  const { data: priceHistory = [] } = useQuery({
    queryKey: ['priceHistory'],
    queryFn: () => base44.entities.PriceHistory.list('-date', 50),
  });

  // Берём самые последние записи по продуктам
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);

  const latestByProduct = {};
  priceHistory
    .filter(ph => new Date(ph.date) >= lastWeek && ph.competitors?.length > 0)
    .forEach(ph => {
      if (!latestByProduct[ph.product_id] || new Date(ph.date) > new Date(latestByProduct[ph.product_id].date)) {
        latestByProduct[ph.product_id] = ph;
      }
    });

  const chartData = Object.values(latestByProduct)
    .slice(0, 8)
    .map(ph => {
      const competitors = ph.competitors || [];
      const avgCompetitorPrice = competitors.length
        ? competitors.reduce((s, c) => s + (c.price || 0), 0) / competitors.length
        : 0;

      return {
        product: ph.product_id?.substring(0, 8),
        ourPrice: ph.our_price || 0,
        avgCompetitor: avgCompetitorPrice,
        diff: (ph.our_price || 0) - avgCompetitorPrice,
      };
    });

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6 shadow-warm-sm">
      <div className="flex items-center gap-2 mb-5">
        <Zap className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Сравнение цен с конкурентами (неделя)</h2>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="product"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v.toFixed(0)}₽`}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              fontSize: 12,
              boxShadow: '0 8px 24px rgba(61,38,20,.10)',
            }}
            formatter={(value) => formatRub(value)}
            labelFormatter={(label) => `SKU: ${label}`}
          />
          <Legend />
          <Bar dataKey="ourPrice" fill="hsl(var(--primary))" name="Наша цена" radius={[4, 4, 0, 0]} />
          <Bar dataKey="avgCompetitor" fill="hsl(var(--secondary))" name="Конкуренты (ср.)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}