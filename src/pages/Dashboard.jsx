import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { formatRub, formatPct } from '@/lib/unitEconomics';
import { TrendingUp, TrendingDown, Users, Package, Calculator, FolderOpen, ArrowUpRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
    { label: 'Клиенты', value: clients.length,     icon: Users,     to: '/clients',   accent: 'bg-[#fff1e8] text-[#9a3412]' },
    { label: 'Проекты', value: projects.length,    icon: FolderOpen, to: '/projects',  accent: 'bg-orange-50 text-orange-700' },
    { label: 'Товары',   value: products.length,    icon: Package,    to: '/products',  accent: 'bg-amber-50 text-amber-700' },
    { label: 'Расчёты',  value: calculations.length, icon: Calculator, to: '/calculations', accent: 'bg-stone-100 text-stone-600' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-7 max-w-7xl mx-auto">
      {/* Page title */}
      <div>
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">Обзор</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Юнит-экономика и аналитика Wildberries</p>
      </div>