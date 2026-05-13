import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Card } from '@/components/ui/card';
import { AlertCircle, TrendingUp, Calendar } from 'lucide-react';

export default function PriceHistoryChart({ productId, selectedProduct }) {
  const [showMargin, setShowMargin] = useState(true);
  const [showCompetitors, setShowCompetitors] = useState(true);
  const [daysBack, setDaysBack] = useState(30);

  const { data: priceHistory = [], isLoading } = useQuery({
    queryKey: ['price-history', productId, daysBack],
    queryFn: async () => {
      if (!productId) return [];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      
      const records = await base44.entities.PriceHistory.filter(
        { product_id: productId },
        '-date',
        100
      );
      
      return records
        .filter(r => new Date(r.date) >= cutoffDate)
        .reverse()
        .map(r => ({
          date: new Date(r.date).toLocaleDateString('ru-RU'),
          dateObj: new Date(r.date),
          our_price: Number(r.our_price) || 0,
          margin_pct: r.margin_pct == null ? null : Number(r.margin_pct),
          cost: r.cost == null ? null : Number(r.cost),
          notes: r.notes,
          competitors: (r.competitors || []).map((comp) => ({
            ...comp,
            price: Number(comp.price) || 0,
          }))
        }));
    },
    enabled: !!productId
  });

  if (!productId || !selectedProduct) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <AlertCircle className="w-4 h-4" />
          Выберите товар для просмотра истории цен
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  if (priceHistory.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">История цен отсутствует</p>
        </div>
      </Card>
    );
  }

  const minPrice = Math.min(...priceHistory.map(d => Number(d.our_price) || 0));
  const maxPrice = Math.max(...priceHistory.map(d => Number(d.our_price) || 0));
  const marginValues = priceHistory
    .map(d => Number(d.margin_pct))
    .filter(v => Number.isFinite(v));
  const avgMargin = marginValues.length
    ? (marginValues.reduce((sum, value) => sum + value, 0) / marginValues.length).toFixed(1)
    : null;
  const firstPrice = Number(priceHistory[0]?.our_price);
  const lastPrice = Number(priceHistory[priceHistory.length - 1]?.our_price);
  const priceChange = Number.isFinite(firstPrice) && firstPrice > 0 && Number.isFinite(lastPrice)
    ? ((lastPrice - firstPrice) / firstPrice * 100).toFixed(1)
    : null;

  const chartData = priceHistory.map(d => {
    const item = {
      date: d.date,
      our_price: Number(d.our_price) || 0,
    };
    
    if (showMargin) {
      item.margin_pct = d.margin_pct;
    }
    
    // Добавляем цены конкурентов в отдельные поля
    if (showCompetitors && d.competitors?.length > 0) {
      d.competitors.forEach((comp, idx) => {
        item[`competitor_${idx}`] = comp.price;
      });
    }
    
    return item;
  });

  const colors = ['#d84315', '#f57c00', '#1976d2', '#388e3c', '#7b1fa2'];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm">{selectedProduct?.name} — История цен</h3>
        </div>
        <div className="flex gap-2 flex-wrap text-xs">
          <label className="flex items-center gap-1 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showMargin} 
              onChange={e => setShowMargin(e.target.checked)}
              className="w-3 h-3"
            />
            Маржа
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showCompetitors} 
              onChange={e => setShowCompetitors(e.target.checked)}
              className="w-3 h-3"
            />
            Конкуренты
          </label>
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-secondary/50 rounded p-2 text-center">
          <div className="text-[9px] text-muted-foreground">Текущая цена</div>
          <div className="text-lg font-bold">{priceHistory[priceHistory.length - 1]?.our_price.toFixed(0)}₽</div>
        </div>
        <div className="bg-secondary/50 rounded p-2 text-center">
          <div className="text-[9px] text-muted-foreground">Min / Max</div>
          <div className="text-lg font-bold">{minPrice.toFixed(0)}₽ / {maxPrice.toFixed(0)}₽</div>
        </div>
        <div className="bg-secondary/50 rounded p-2 text-center">
          <div className="text-[9px] text-muted-foreground">Изменение</div>
          <div className={`text-lg font-bold ${(Number(priceChange) || 0) >= 0 ? 'text-destructive' : 'text-success'}`}>
            {priceChange != null ? `${Number(priceChange) > 0 ? '+' : ''}${priceChange}%` : '—'}
          </div>
        </div>
        <div className="bg-secondary/50 rounded p-2 text-center">
          <div className="text-[9px] text-muted-foreground">Средняя маржа</div>
          <div className="text-lg font-bold text-success">{avgMargin != null ? `${avgMargin}%` : '—'}</div>
        </div>
      </div>

      {/* График цен */}
      <div className="mb-4">
        <div className="text-[11px] font-semibold text-muted-foreground mb-2">Динамика цен</div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d84315" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#d84315" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
              label={{ value: 'Цена, ₽', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '8px'
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value) => Number(value).toFixed(0)}
              cursor={{ stroke: 'hsl(var(--muted-foreground))' }}
            />
            <Area 
              type="monotone" 
              dataKey="our_price" 
              stroke="#d84315" 
              strokeWidth={2}
              fill="url(#colorPrice)" 
              name="Наша цена"
              isAnimationActive={false}
            />
            {showCompetitors && priceHistory.some(d => d.competitors?.length > 0) && (
              <>
                {[0, 1, 2, 3, 4].map(idx => 
                  priceHistory.some(d => d.competitors?.[idx]) ? (
                    <Line
                      key={`competitor_${idx}`}
                      type="monotone"
                      dataKey={`competitor_${idx}`}
                      stroke={colors[idx % colors.length]}
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                      isAnimationActive={false}
                      name={priceHistory.find(d => d.competitors?.[idx])?.competitors?.[idx]?.name || `Конкурент ${idx + 1}`}
                    />
                  ) : null
                )}
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* График маржинальности */}
      {showMargin && priceHistory.some(d => d.margin_pct != null) && (
        <div>
          <div className="text-[11px] font-semibold text-muted-foreground mb-2">Динамика маржинальности</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
                label={{ value: 'Маржа, %', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  padding: '8px'
                }}
                formatter={(value) => Number(value).toFixed(1)}
                cursor={{ stroke: 'hsl(var(--muted-foreground))' }}
              />
              <Line 
                type="monotone" 
                dataKey="margin_pct" 
                stroke="#4caf50" 
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
                name="Маржинальность"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Фильтр по дням */}
      <div className="mt-4 pt-4 border-t border-border/40 flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Период:</span>
        <div className="flex gap-1">
          {[7, 14, 30, 60, 90].map(days => (
            <button
              key={days}
              onClick={() => setDaysBack(days)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                daysBack === days
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {days}д
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
