import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { TrendingUp, AlertCircle } from 'lucide-react';

const ABC_THRESHOLDS = {
  A: { min: 80, color: '#4caf50', label: 'A - Ключевые' },
  B: { min: 15, color: '#ff9800', label: 'B - Важные' },
  C: { min: 0, color: '#f44336', label: 'C - Прочие' }
};

export default function ABCAnalysisPanel() {
  const [periodDays, setPeriodDays] = useState(30);
  const [metric, setMetric] = useState('profit'); // profit | revenue | units

  // Загружаем данные продаж
  const { data: salesData = [] } = useQuery({
    queryKey: ['sales-data'],
    queryFn: () => base44.entities.SalesData.list('-period_end', 1000),
    refetchInterval: 300000 // 5 минут
  });

  // Загружаем товары для маппинга
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  // Анализируем данные и проводим ABC классификацию
  const analysisData = useMemo(() => {
    if (!salesData.length) return { items: [], distribution: [], summary: {} };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    // Группируем по товарам и суммируем метрики за период
    const groupedByProduct = {};
    salesData.forEach(sale => {
      if (new Date(sale.period_end) < cutoffDate) return;

      if (!groupedByProduct[sale.product_id]) {
        groupedByProduct[sale.product_id] = {
          product_id: sale.product_id,
          units_sold: 0,
          revenue: 0,
          profit: 0,
          margin_pct: 0,
          count: 0
        };
      }

      const item = groupedByProduct[sale.product_id];
      item.units_sold += sale.units_sold || 0;
      item.revenue += sale.revenue || 0;
      item.profit += sale.profit || 0;
      item.count += 1;
    });

    // Рассчитываем среднюю маржу
    Object.keys(groupedByProduct).forEach(prodId => {
      const item = groupedByProduct[prodId];
      item.margin_pct = item.revenue > 0 ? (item.profit / item.revenue * 100) : 0;
    });

    // Получаем метрику для анализа
    const metricKey = metric === 'profit' ? 'profit' : metric === 'revenue' ? 'revenue' : 'units_sold';
    const items = Object.values(groupedByProduct)
      .map(item => ({
        ...item,
        product_name: products.find(p => p.id === item.product_id)?.name || `Товар ${item.product_id}`,
        metricValue: item[metricKey]
      }))
      .sort((a, b) => b.metricValue - a.metricValue);

    // ABC классификация (Парето)
    const totalMetric = items.reduce((sum, item) => sum + item.metricValue, 0);
    let cumulativePercent = 0;
    const itemsWithClass = items.map(item => {
      cumulativePercent += (item.metricValue / totalMetric) * 100;
      let abcClass = 'C';
      if (cumulativePercent <= ABC_THRESHOLDS.A.min) {
        abcClass = 'A';
      } else if (cumulativePercent <= ABC_THRESHOLDS.A.min + ABC_THRESHOLDS.B.min) {
        abcClass = 'B';
      }
      return { ...item, abcClass, cumulativePercent };
    });

    // Статистика по классам
    const summary = {
      A: { count: 0, metricValue: 0, revenue: 0, profit: 0 },
      B: { count: 0, metricValue: 0, revenue: 0, profit: 0 },
      C: { count: 0, metricValue: 0, revenue: 0, profit: 0 }
    };

    itemsWithClass.forEach(item => {
      summary[item.abcClass].count += 1;
      summary[item.abcClass].metricValue += item.metricValue;
      summary[item.abcClass].revenue += item.revenue;
      summary[item.abcClass].profit += item.profit;
    });

    // Подготавливаем данные для графиков
    const distributionData = [
      { name: 'A - Ключевые', value: summary.A.count, metric: summary.A.metricValue.toFixed(0) },
      { name: 'B - Важные', value: summary.B.count, metric: summary.B.metricValue.toFixed(0) },
      { name: 'C - Прочие', value: summary.C.count, metric: summary.C.metricValue.toFixed(0) }
    ];

    return { items: itemsWithClass, distribution: distributionData, summary, totalMetric };
  }, [salesData, products, periodDays, metric]);

  const metricLabel = metric === 'profit' ? 'Прибыль' : metric === 'revenue' ? 'Выручка' : 'Продажи';
  const metricUnit = metric === 'units' ? 'шт' : '₽';

  return (
    <div className="space-y-4">
      {/* Настройки и фильтры */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-base">ABC-анализ товаров</h2>
          </div>
          
          <div className="flex gap-4 flex-wrap">
            {/* Выбор метрики */}
            <div className="flex gap-1">
              {[
                { value: 'profit', label: 'По прибыли' },
                { value: 'revenue', label: 'По выручке' },
                { value: 'units', label: 'По объему' }
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMetric(opt.value)}
                  className={`px-3 py-1.5 rounded text-[11px] font-medium transition-all ${
                    metric === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Выбор периода */}
            <div className="flex gap-1">
              {[7, 14, 30, 90].map(days => (
                <button
                  key={days}
                  onClick={() => setPeriodDays(days)}
                  className={`px-3 py-1.5 rounded text-[11px] font-medium transition-all ${
                    periodDays === days
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {days}д
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Сводка по классам */}
      {analysisData.summary && Object.keys(analysisData.summary).length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {['A', 'B', 'C'].map(cls => {
            const stats = analysisData.summary[cls];
            const color = ABC_THRESHOLDS[cls].color;
            return (
              <Card key={cls} className="p-3" style={{ borderLeftWidth: '4px', borderLeftColor: color }}>
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
                  {ABC_THRESHOLDS[cls].label}
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Товаров:</span>
                    <span className="font-bold">{stats.count}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">{metricLabel}:</span>
                    <span className="font-bold">{stats[metric === 'profit' ? 'profit' : metric === 'revenue' ? 'revenue' : 'metricValue']?.toFixed(0)}{metricUnit === '₽' ? '₽' : ''}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Доля:</span>
                    <span className="font-bold text-success">{analysisData.totalMetric ? ((stats.metricValue / analysisData.totalMetric) * 100).toFixed(1) : 0}%</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Графики */}
      {analysisData.distribution.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Пирограмма распределения */}
          <Card className="p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Распределение товаров
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analysisData.distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}\n${value} шт`}
                >
                  {['A', 'B', 'C'].map((cls, idx) => (
                    <Cell key={`cell-${idx}`} fill={ABC_THRESHOLDS[cls].color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} товаров`} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* График метрики по классам */}
          <Card className="p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              {metricLabel} по классам
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analysisData.distribution} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => `${value}${metricUnit}`}
                />
                <Bar dataKey="metric" fill="#8884d8" radius={[4, 4, 0, 0]}>
                  {['A', 'B', 'C'].map((cls, idx) => (
                    <Cell key={`cell-${idx}`} fill={ABC_THRESHOLDS[cls].color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Таблица товаров */}
      <Card className="p-4">
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Детальный список товаров
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 px-2 font-semibold">Класс</th>
                <th className="py-2 px-2 font-semibold">Товар</th>
                <th className="py-2 px-2 font-semibold text-right">Продано</th>
                <th className="py-2 px-2 font-semibold text-right">Выручка</th>
                <th className="py-2 px-2 font-semibold text-right">Прибыль</th>
                <th className="py-2 px-2 font-semibold text-right">Маржа</th>
                <th className="py-2 px-2 font-semibold text-right">Доля</th>
              </tr>
            </thead>
            <tbody>
              {analysisData.items.slice(0, 20).map((item, idx) => (
                <tr
                  key={item.product_id}
                  className="border-b border-border/50 hover:bg-secondary/30"
                  style={{ 
                    borderLeftWidth: '3px',
                    borderLeftColor: ABC_THRESHOLDS[item.abcClass].color,
                    background: idx % 2 === 0 ? 'transparent' : 'hsl(var(--secondary) / 0.1)'
                  }}
                >
                  <td className="py-2 px-2">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: ABC_THRESHOLDS[item.abcClass].color }}
                    >
                      {item.abcClass}
                    </span>
                  </td>
                  <td className="py-2 px-2 truncate max-w-xs">{item.product_name}</td>
                  <td className="py-2 px-2 text-right font-mono">{item.units_sold} шт</td>
                  <td className="py-2 px-2 text-right font-mono">{item.revenue.toFixed(0)}₽</td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-success">{item.profit.toFixed(0)}₽</td>
                  <td className="py-2 px-2 text-right font-mono">{item.margin_pct.toFixed(1)}%</td>
                  <td className="py-2 px-2 text-right font-mono text-[10px]">
                    {((item.metricValue / analysisData.totalMetric) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {analysisData.items.length > 20 && (
            <div className="text-center py-2 text-[10px] text-muted-foreground">
              ... и ещё {analysisData.items.length - 20} товаров
            </div>
          )}
        </div>
      </Card>

      {/* Рекомендации */}
      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="flex gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-800">
            <p className="font-semibold mb-1">Рекомендации по управлению:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Класс A:</strong> Поддерживайте оптимальный уровень стока, минимизируйте возвраты</li>
              <li><strong>Класс B:</strong> Анализируйте конкуренцию, поднимайте маржу где возможно</li>
              <li><strong>Класс C:</strong> Пересмотрите цены или снимите с продажи неприбыльные товары</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}