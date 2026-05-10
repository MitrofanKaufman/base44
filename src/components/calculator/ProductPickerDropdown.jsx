import { useState, useEffect, useRef } from 'react';
import { Search, X, Package, Check } from 'lucide-react';

export default function ProductPickerDropdown({ products, selectedProduct, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const ref = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = products.filter(p =>
    !query ||
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.wb_sku || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1.5 z-50 w-80 bg-card border border-border rounded-xl shadow-warm-lg overflow-hidden"
    >
      {/* Search */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center gap-2 px-2.5 h-8 rounded-md bg-secondary/50 border border-border/50">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск товара или SKU..."
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-auto">
        {/* Clear selection */}
        {selectedProduct && (
          <button
            onClick={() => onSelect(null)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors border-b border-border/40"
          >
            <X className="w-3.5 h-3.5" />
            Сбросить выбор
          </button>
        )}

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
            <Package className="w-8 h-8 opacity-20" />
            <p className="text-xs">Товары не найдены</p>
          </div>
        ) : (
          filtered.map(p => {
            const isActive = p.id === selectedProduct?.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${isActive ? 'bg-primary/5' : ''}`}
              >
                {/* Thumbnail */}
                <div className="w-9 h-9 rounded-md overflow-hidden bg-secondary/50 flex-shrink-0 flex items-center justify-center">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    : <Package className="w-4 h-4 text-muted-foreground/30" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                    {p.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    SKU: {p.wb_sku || '—'}
                    {p.category && <span className="ml-2 non-mono text-muted-foreground/70">{p.category}</span>}
                  </p>
                </div>

                {/* Price */}
                {p.sale_price || p.price ? (
                  <span className="text-xs font-bold text-foreground flex-shrink-0">
                    {(p.sale_price || p.price).toLocaleString('ru-RU')} ₽
                  </span>
                ) : null}

                {isActive && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
              </button>
            );
          })
        )}
      </div>

      {/* Footer count */}
      <div className="px-3 py-1.5 border-t border-border bg-secondary/20">
        <p className="text-[10px] text-muted-foreground">
          {filtered.length} из {products.length} товаров
        </p>
      </div>
    </div>
  );
}