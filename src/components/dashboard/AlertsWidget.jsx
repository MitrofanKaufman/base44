import { useMemo } from 'react';
import { AlertTriangle, TrendingDown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPct, formatRub } from '@/lib/unitEconomics';

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export default function AlertsWidget({ calculations, products }) {
  const alerts = useMemo(() => {
    if (!calculations.length || !products.length) return [];

    const productMap = Object.fromEntries(products.map(p => [p.id, p]));
    const now = Date.now();
    const cutoff = now - ONE_MONTH_MS;

    // Group calculations by product, get latest per product
    const byProduct = {};
    for (const c of calculations) {
      if (!c.product_id) continue;
      const ts = new Date(c.created_date || c.updated_date || 0).getTime();
      if (!byProduct[c.product_id] || ts > byProduct[c.product_id].ts) {
        byProduct[c.product_id] = { calc: c, ts };
      }
    }

    const result = [];
    for (const [productId, { calc, ts }] of Object.entries(byProduct)) {
      const margin = calc.gross_margin_pct ?? calc.contribution_pct ?? 0;
      const isNeg = margin < 0;
      const isLow = margin >= 0 && margin < 5;
      const isRecent = ts >= cutoff;

      if ((isNeg || isLow) && isRecent) {
        result.push({
          productId,
          product: productMap[productId],
          calc,
          margin,
          isNeg,
          contribution: calc.contribution ?? 0,
        });
      }
    }

    // Sort: negative first, then by margin ascending
    return result.sort((a, b) => {
      if (a.isNeg && !b.isNeg) return -1;
      if (!a.isNeg && b.isNeg) return 1;
      return a.margin - b.margin;
    });
  }, [calculations, products]);

  if (alerts.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border border-amber-200 shadow-warm-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-amber-200 bg-amber-50/60">
        <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-amber-900">Тревожные сигналы</h2>
          <p className="text-[11px] text-amber-700/80">Товары с маржой ниже 5% или в убытке за последний месяц</p>
        </div>
        <span className="ml-auto flex-shrink-0 bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
          {alerts.length}
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-border">
        {alerts.map(({ productId, product, calc, margin, isNeg, contribution }) => (
          <div key={productId} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors">
            {/* Icon */}
            <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
              isNeg ? 'bg-red-50' : 'bg-amber-50'
            }`}>
              <TrendingDown className={`w-4 h-4 ${isNeg ? 'text-destructive' : 'text-amber-500'}`} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground truncate">
                  {product?.name || 'Неизвестный товар'}
                </span>
                {product?.wb_sku && (
                  <span className="text-xs font-mono text-muted-foreground/70">· {product.wb_sku}</span>
                )}
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md border ${
                  isNeg
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isNeg ? '⚠ Убыточно' : '↓ Низкая маржа'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className={`text-xs font-bold ${isNeg ? 'text-destructive' : 'text-amber-600'}`}>
                  Маржа: {formatPct(margin)}
                </span>
                <span className={`text-xs ${contribution < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  Contribution: {formatRub(contribution)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {calc.name || 'Расчёт'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Link
                to={`/calculations?product_id=${productId}`}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline px-2 py-1 rounded-md hover:bg-accent transition-colors"
              >
                Пересчитать <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}