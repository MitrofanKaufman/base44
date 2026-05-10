import { Package, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

const FLabel = ({ children }) => (
  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
);

export default function ProductSelector({ products, projects, selectedProduct, onSelect, form, setField }) {
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  return (
    <div className="bg-card rounded-lg border border-border shadow-warm-sm overflow-hidden">
      <div className="flex gap-0">
        {/* Product image */}
        <div className="w-44 h-44 flex-shrink-0 bg-secondary/30 relative overflow-hidden">
          {selectedProduct?.image_url ? (
            <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
              <Package className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-[11px] text-muted-foreground/60">Выберите товар</p>
            </div>
          )}
          {selectedProduct && (
            <button
              onClick={() => onSelect(null)}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          )}
        </div>

        {/* Right inputs */}
        <div className="flex-1 p-4 space-y-3">
          <div>
            <FLabel>Товар</FLabel>
            <Select value={selectedProduct?.id || ''} onValueChange={id => onSelect(products.find(p => p.id === id) || null)}>
              <SelectTrigger className="mt-1 h-8 text-sm rounded-md bg-secondary/30 border-border">
                <SelectValue placeholder="Выберите товар из базы..." />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-muted-foreground font-mono text-xs">{p.wb_sku}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProduct && (
              <p className="text-xs text-muted-foreground mt-1">
                {projectMap[selectedProduct.project_id]?.name}
                <span className="font-mono ml-2 opacity-60">{selectedProduct.wb_sku}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <FLabel>Цена продажи (₽)</FLabel>
              <Input
                className="mt-1 h-8 text-sm rounded-md font-semibold"
                type="number"
                value={form.price || ''}
                onChange={e => setField('price', +e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <FLabel>Комиссия WB (%)</FLabel>
              <Input
                className="mt-1 h-8 text-sm rounded-md"
                type="number"
                step="0.1"
                value={form.wb_commission_pct || ''}
                onChange={e => setField('wb_commission_pct', +e.target.value)}
              />
            </div>
            <div>
              <FLabel>Схема</FLabel>
              <Select value={form.fulfillment_mode} onValueChange={v => setField('fulfillment_mode', v)}>
                <SelectTrigger className="mt-1 h-8 text-sm rounded-md"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FBO">FBO</SelectItem>
                  <SelectItem value="FBS">FBS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <FLabel>Налог (%)</FLabel>
              <Input className="mt-1 h-8 text-sm rounded-md" type="number" step="0.1" value={form.tax_pct} onChange={e => setField('tax_pct', +e.target.value)} />
            </div>
            <div>
              <FLabel>Эквайринг (%)</FLabel>
              <Input className="mt-1 h-8 text-sm rounded-md" type="number" step="0.1" value={form.acquiring_pct} onChange={e => setField('acquiring_pct', +e.target.value)} />
            </div>
            <div>
              <FLabel>Возвраты (%)</FLabel>
              <Input className="mt-1 h-8 text-sm rounded-md" type="number" step="0.1" value={form.return_rate_pct} onChange={e => setField('return_rate_pct', +e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}