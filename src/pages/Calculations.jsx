import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Calculator, Pencil, Trash2, TrendingUp, TrendingDown, AlertTriangle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { formatRub, formatPct } from '@/lib/unitEconomics';
import { useState } from 'react';

export default function Calculations() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const urlParams    = new URLSearchParams(window.location.search);
  const preProductId = urlParams.get('product_id');

  // If arrived with ?product_id=, redirect straight to calculator
  useEffect(() => {
    if (preProductId) navigate(`/calculator?product_id=${preProductId}`, { replace: true });
  }, [preProductId]);

  const { data: calculations = [], isLoading } = useQuery({
    queryKey: ['calculations'],
    queryFn:  () => base44.entities.Calculation.list('-created_date'),
  });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: clients  = [] } = useQuery({ queryKey: ['clients'],  queryFn: () => base44.entities.Client.list() });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Calculation.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['calculations'] }),
  });

  const productMap = Object.fromEntries(products.map(p => [p.id, p]));
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const clientMap  = Object.fromEntries(clients.map(c  => [c.id, c]));

  const filtered = calculations.filter(c => {
    const prod = productMap[c.product_id];
    return (
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      prod?.name?.toLowerCase().includes(search.toLowerCase()) ||
      prod?.wb_sku?.includes(search)
    );
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Расчёты юнит-экономики</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{calculations.length} расчётов</p>
        </div>
        <Button
          onClick={() => navigate('/calculator')}
          className="gap-2 rounded-md shadow-warm-sm"
        >
          <Plus className="w-4 h-4" /> Новый расчёт
        </Button>
      </div>

      {/* No products notice */}
      {products.length === 0 && (
        <div className="flex items-center gap-3 bg-accent border border-border rounded-lg p-4 text-sm text-accent-foreground">
          <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
          <span>Сначала добавьте <Link to="/products" className="underline font-semibold">товар</Link>.</span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 rounded-md bg-card border-border"
          placeholder="Поиск по товару или названию расчёта..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-card rounded-lg border h-24 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground bg-card rounded-lg border border-border shadow-warm-sm">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Calculator className="w-6 h-6 opacity-40" />
          </div>
          <p className="font-medium">Нет расчётов</p>
          <button
            onClick={() => navigate('/calculator')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Calculator className="w-4 h-4" /> Открыть калькулятор
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-warm-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="col-span-5">Расчёт / Товар</div>
            <div className="col-span-2 hidden md:block">Схема</div>
            <div className="col-span-2 text-right hidden sm:block">Contribution</div>
            <div className="col-span-1 text-right hidden lg:block">Маржа</div>
            <div className="col-span-1 text-right hidden lg:block">BEP</div>
            <div className="col-span-2 lg:col-span-1 text-right">Действия</div>
          </div>

          {filtered.map((calc, idx) => {
            const product    = productMap[calc.product_id];
            const project    = projectMap[calc.project_id] || projectMap[product?.project_id];
            const client     = clientMap[calc.client_id]   || clientMap[project?.client_id];
            const profitable = calc.is_profitable;
            const isFBS      = calc.fulfillment_mode === 'FBS';
            const contribPos = (calc.contribution ?? 0) >= 0;

            return (
              <div
                key={calc.id}
                className={`grid grid-cols-12 gap-3 px-5 py-4 items-center hover:bg-muted/30 transition-colors ${idx !== filtered.length - 1 ? 'border-b border-border' : ''}`}
              >
                {/* Name / product */}
                <div className="col-span-10 sm:col-span-7 md:col-span-5 flex items-start gap-3 min-w-0">
                  <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${
                    profitable ? 'bg-emerald-50' : profitable === false ? 'bg-red-50' : 'bg-muted'
                  }`}>
                    {profitable
                      ? <TrendingUp className="w-4 h-4 text-success" />
                      : profitable === false
                        ? <TrendingDown className="w-4 h-4 text-destructive" />
                        : <Calculator className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[14px] text-foreground">{calc.name || 'Без названия'}</span>
                      {!profitable && profitable !== undefined && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md font-medium">
                          <AlertTriangle className="w-3 h-3" /> Убыточно
                        </span>
                      )}
                    </div>
                    {product && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {product.name}
                        <span className="font-mono ml-1 opacity-60">· {product.wb_sku}</span>
                      </p>
                    )}
                    {client && (
                      <p className="text-xs text-muted-foreground">
                        {client.name}{project ? ` · ${project.name}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Scheme */}
                <div className="col-span-2 hidden md:block">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                    isFBS
                      ? 'bg-violet-50 text-violet-700 border border-violet-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {calc.fulfillment_mode}
                  </span>
                </div>

                {/* Contribution */}
                <div className="col-span-2 text-right hidden sm:block">
                  <p className={`text-sm font-bold ${contribPos ? 'text-success' : 'text-destructive'}`}>
                    {formatRub(calc.contribution)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatPct(calc.contribution_pct)}</p>
                </div>

                {/* Margin */}
                <div className="col-span-1 text-right hidden lg:block">
                  <p className="text-sm font-semibold">{formatPct(calc.gross_margin_pct)}</p>
                </div>

                {/* BEP */}
                <div className="col-span-1 text-right hidden lg:block">
                  {calc.bep_units
                    ? <p className="text-sm font-semibold">{Math.ceil(calc.bep_units)} шт</p>
                    : <p className="text-xs text-muted-foreground">—</p>
                  }
                </div>

                {/* Actions */}
                <div className="col-span-2 lg:col-span-1 flex justify-end gap-0.5">
                  <button
                    onClick={() => navigate(`/calculator${calc.product_id ? `?product_id=${calc.product_id}` : ''}`)}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="Открыть в калькуляторе"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => { if (confirm('Удалить расчёт?')) deleteMut.mutate(calc.id); }}
                    className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}