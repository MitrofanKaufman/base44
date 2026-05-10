import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Package, Pencil, Trash2, RefreshCw, Calculator, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import ProductModal from '@/components/products/ProductModal';
import WbImportModal from '@/components/products/WbImportModal';
import { formatRub } from '@/lib/unitEconomics';
import SalesDynamicsChart from '@/components/SalesDynamicsChart';

export default function Products() {
  const qc = useQueryClient();
  const [search,    setSearch]    = useState('');
  const [editing,   setEditing]   = useState(null);
  const [creating,  setCreating]  = useState(false);
  const [importing, setImporting] = useState(false);
  const [chartProduct, setChartProduct] = useState(null); // null = all products

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn:  () => base44.entities.Product.list('-created_date'),
  });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: clients  = [] } = useQuery({ queryKey: ['clients'],  queryFn: () => base44.entities.Client.list() });
  const { data: calculations = [] } = useQuery({ queryKey: ['calculations'], queryFn: () => base44.entities.Calculation.list('-created_date', 100) });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const clientMap  = Object.fromEntries(clients.map(c => [c.id, c]));

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.wb_sku?.includes(search)
  );

  const selectedProductForChart = chartProduct ? products.find(p => p.id === chartProduct) : null;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Товары</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} товаров</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImporting(true)} className="gap-2 rounded-md">
            <RefreshCw className="w-4 h-4" /> Импорт с WB
          </Button>
          <Button
            onClick={() => setCreating(true)}
            className="gap-2 rounded-md shadow-warm-sm"
            disabled={projects.length === 0}
          >
            <Plus className="w-4 h-4" /> Добавить товар
          </Button>
        </div>
      </div>

      {/* No projects notice */}
      {projects.length === 0 && (
        <div className="flex items-center gap-3 bg-accent border border-border rounded-lg p-4 text-sm text-accent-foreground">
          <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
          <span>Сначала создайте <Link to="/projects" className="underline font-semibold">проект</Link>.</span>
        </div>
      )}

      {/* Sales dynamics chart */}
      <div className="space-y-2">
        {/* Product filter for chart */}
        {products.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">График:</span>
            <button
              onClick={() => setChartProduct(null)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                !chartProduct
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              Все товары
            </button>
            {products.slice(0, 5).map(p => (
              <button
                key={p.id}
                onClick={() => setChartProduct(p.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                  chartProduct === p.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                {p.name.slice(0, 18)}{p.name.length > 18 ? '…' : ''}
              </button>
            ))}
          </div>
        )}
        <SalesDynamicsChart
          calculations={calculations}
          productFilter={chartProduct}
          title={selectedProductForChart
            ? `Динамика: ${selectedProductForChart.name.slice(0, 30)}`
            : 'Динамика Contribution по всем товарам'
          }
        />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 rounded-md bg-card border-border"
          placeholder="Поиск по названию или артикулу WB..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="bg-card rounded-lg border h-56 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground bg-card rounded-lg border border-border shadow-warm-sm">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6 opacity-40" />
          </div>
          <p className="font-medium">Нет товаров</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(product => {
            const project = projectMap[product.project_id];
            const client  = clientMap[product.client_id] || clientMap[project?.client_id];
            const isFBS   = product.fulfillment_mode === 'FBS';
            return (
              <div
                key={product.id}
                className="bg-card rounded-lg border border-border overflow-hidden shadow-warm-sm hover:shadow-warm transition-shadow"
              >
                <div className="h-40 bg-secondary/30 flex items-center justify-center overflow-hidden">
                  {product.image_url
                    ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    : <Package className="w-12 h-12 text-muted-foreground/20" />
                  }
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">Арт: {product.wb_sku}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-semibold flex-shrink-0 ${
                      isFBS
                        ? 'bg-violet-50 text-violet-700 border border-violet-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {product.fulfillment_mode}
                    </span>
                  </div>

                  {project && (
                    <p className="text-xs text-muted-foreground">
                      {client?.name && <span className="font-medium text-foreground/80">{client.name}</span>}
                      {client && project && <span className="mx-1 opacity-40">·</span>}
                      {project.name}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div>
                      {product.sale_price && (
                        <p className="text-sm font-bold text-foreground">{formatRub(product.sale_price)}</p>
                      )}
                      {product.price && product.sale_price && product.price !== product.sale_price && (
                        <p className="text-xs text-muted-foreground line-through">{formatRub(product.price)}</p>
                      )}
                    </div>
                    <div className="flex gap-0.5">
                      <button
                        onClick={() => setChartProduct(chartProduct === product.id ? null : product.id)}
                        className={`p-1.5 rounded-md transition-colors ${chartProduct === product.id ? 'bg-accent text-primary' : 'hover:bg-accent'}`}
                        title="Показать динамику"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <Link
                        to={`/calculations?product_id=${product.id}`}
                        className="p-1.5 rounded-md hover:bg-accent transition-colors"
                        title="Рассчитать"
                      >
                        <Calculator className="w-3.5 h-3.5 text-primary" />
                      </Link>
                      <button onClick={() => setEditing(product)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => { if (confirm('Удалить товар?')) deleteMut.mutate(product.id); }}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <ProductModal product={editing} projects={projects} clients={clients} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
      {importing && (
        <WbImportModal projects={projects} clients={clients} onClose={() => setImporting(false)} />
      )}
    </div>
  );
}