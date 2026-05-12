import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AlertsPanel from '@/components/alerts/AlertsPanel';
import { formatRub } from '@/lib/unitEconomics';
import { Users, Package, Calculator, FolderOpen, ArrowUpRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SalesDynamicsChart from '@/components/SalesDynamicsChart';
import MarginTrendChart from '@/components/dashboard/MarginTrendChart';
import CompetitorPriceComparisonChart from '@/components/dashboard/CompetitorPriceComparisonChart';
import CriticalAlertsWidget from '@/components/dashboard/CriticalAlertsWidget';

export default function Dashboard() {
  const { data: clients      = [] } = useQuery({ queryKey: ['clients'],      queryFn: () => base44.entities.Client.list() });
  const { data: projects     = [] } = useQuery({ queryKey: ['projects'],     queryFn: () => base44.entities.Project.list() });
  const { data: products     = [] } = useQuery({ queryKey: ['products'],     queryFn: () => base44.entities.Product.list() });
  const { data: calculations = [] } = useQuery({ queryKey: ['calculations'], queryFn: () => base44.entities.Calculation.list('-created_date', 50) });

  const profitable   = calculations.filter(c => c.is_profitable).length;
  const unprofitable = calculations.filter(c => c.is_profitable === false).length;
  const avgContrib   = calculations.length
    ? calculations.reduce((s, c) => s + (c.contribution ?? 0), 0) / calculations.length
    : 0;

  const chartData = calculations.slice(0, 10).reverse().map((c, i) => ({
    name:         c.name || `Расч. ${i + 1}`,
    contribution: c.contribution ?? 0,
    grossProfit:  c.gross_profit  ?? 0,
  }));

  const stats = [
    { label: 'Клиенты',  value: clients.length,      icon: Users,      to: '/clients',      accent: 'bg-[#fff1e8] text-[#9a3412]' },
    { label: 'Проекты',  value: projects.length,     icon: FolderOpen, to: '/projects',     accent: 'bg-orange-50 text-orange-700' },
    { label: 'Товары',   value: products.length,     icon: Package,    to: '/products',     accent: 'bg-amber-50 text-amber-700' },
    { label: 'Расчёты',  value: calculations.length, icon: Calculator, to: '/calculations', accent: 'bg-stone-100 text-stone-600' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-7 max-w-7xl mx-auto">

      {/* Page title */}
      <div>
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">Обзор</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Юнит-экономика и аналитика Wildberries</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, to, accent }) => (
          <Link
            key={label}
            to={to}
            className="bg-card rounded-lg border border-border p-5 shadow-warm-sm hover:shadow-warm transition-shadow group flex flex-col gap-4"
          >
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-md flex items-center justify-center ${accent}`}>
                <Icon className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-1.5 font-medium">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Avg contribution */}
        <div className="bg-card rounded-lg border border-border p-5 shadow-warm-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Ср. Contribution</p>
          <p className={`text-2xl font-bold ${avgContrib >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatRub(avgContrib)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">на единицу товара</p>
        </div>

        {/* Profitability */}
        <div className="bg-card rounded-lg border border-border p-5 shadow-warm-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Прибыльность</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-success">{profitable}</p>
            {unprofitable > 0 && <p className="text-sm text-destructive mb-0.5 font-medium">/ {unprofitable} убыточных</p>}
          </div>
          {calculations.length > 0 && (
            <div className="w-full bg-border rounded-full h-1.5 mt-4">
              <div
                className="bg-success h-1.5 rounded-full transition-all"
                style={{ width: `${(profitable / calculations.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Active clients */}
        <div className="bg-card rounded-lg border border-border p-5 shadow-warm-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Активных клиентов</p>
          <p className="text-2xl font-bold text-foreground">
            {clients.filter(c => c.status === 'active').length}
          </p>
          <p className="text-xs text-muted-foreground mt-1">из {clients.length} всего</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-6 shadow-warm-sm">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Contribution margin по расчётам</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `${v}₽`}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: '0 8px 24px rgba(61,38,20,.10)',
                }}
                formatter={v => [formatRub(v), 'Contribution']}
                cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
              />
              <Bar dataKey="contribution" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.contribution >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Critical alerts widget */}
      <CriticalAlertsWidget />

      {/* Margin trend and competitor comparison row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MarginTrendChart />
        <CompetitorPriceComparisonChart />
      </div>

      {/* Alerts panel */}
      <AlertsPanel />

      {/* Sales dynamics line chart */}
      {calculations.length >= 2 && (
        <SalesDynamicsChart
          calculations={calculations}
          productFilter={null}
          title="Динамика Contribution по расчётам"
        />
      )}

      {/* Empty state */}
      {calculations.length === 0 && (
        <div className="bg-card rounded-lg border border-border p-14 text-center shadow-warm-sm">
          <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4">
            <Calculator className="w-7 h-7 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-base">Ещё нет расчётов</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto leading-relaxed">
            Добавьте клиента, создайте проект, добавьте товар — и запустите расчёт юнит-экономики
          </p>
          <Link
            to="/clients"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors shadow-warm-sm"
          >
            Начать с клиента
          </Link>
        </div>
      )}
    </div>
  );
}
