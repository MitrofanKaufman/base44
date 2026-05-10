import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Plus, Loader2, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRub, formatPct } from '@/lib/unitEconomics';
import { cn } from '@/lib/utils';

export default function CompetitorComparisonPanel() {
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [competitorSku, setCompetitorSku] = useState('');
  const [competitorName, setCompetitorName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [competitors, setCompetitors] = useState({});

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-updated_date', 100)
  });

  const { data: calculations = [] } = useQuery({
    queryKey: ['calculations'],
    queryFn: () => base44.entities.Calculation.list('-created_date', 100)
  });

  const selectedProduct = selectedProductId 
    ? products.find(p => p.id === selectedProductId)
    : null;

  const selectedCalc = selectedProductId
    ? calculations.find(c => c.product_id === selectedProductId)
    : null;

  const handleImportCompetitor = async () => {
    if (!competitorSku || !competitorName || !selectedProductId) {
      setError('Заполните все поля');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Получаем данные конкурента через LLM
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Найди информацию о товаре на Wildberries с артикулом/SKU "${competitorSku}". 
                 Верни в JSON формате: {
                   price: число (текущая цена в рублях),
                   name: строка (название товара),
                   commission_pct: число (комиссия WB в процентах),
                   rating: число (рейтинг продавца 0-5),
                   seller_name: строка (название продавца)
                 }
                 Если информация недоступна, использую примерные данные на основе SKU.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            price: { type: 'number' },
            name: { type: 'string' },
            commission_pct: { type: 'number' },
            rating: { type: 'number' },
            seller_name: { type: 'string' }
          }
        }
      });

      if (!result) throw new Error('Не удалось получить данные');

      // Сохраняем данные конкурента
      const newCompetitor = {
        id: `${selectedProductId}-${competitorName}`,
        productId: selectedProductId,
        sku: competitorSku,
        name: competitorName,
        data: result,
        importedAt: new Date().toISOString()
      };

      setCompetitors(prev => ({
        ...prev,
        [newCompetitor.id]: newCompetitor
      }));

      setCompetitorSku('');
      setCompetitorName('');
    } catch (err) {
      setError(`Ошибка: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const removeCompetitor = (competitorId) => {
    setCompetitors(prev => {
      const newCompetitors = { ...prev };
      delete newCompetitors[competitorId];
      return newCompetitors;
    });
  };

  const productCompetitors = Object.values(competitors).filter(
    c => c.productId === selectedProductId
  );

  return (
    <div className="space-y-4">
      {/* Product selector */}
      <div className="bg-card rounded-[18px] border border-border shadow-warm-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-foreground">
            Выбор товара
          </span>
        </div>

        <select
          value={selectedProductId || ''}
          onChange={e => {
            setSelectedProductId(e.target.value || null);
            setCompetitors({});
          }}
          className="w-full h-9 px-3 border border-border rounded-lg bg-card text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Выберите товар...</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} {p.wb_sku && `(${p.wb_sku})`}
            </option>
          ))}
        </select>

        {selectedProduct && selectedCalc && (
          <div className="mt-3 p-3 bg-secondary/30 rounded-lg space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Наша цена:</span>
              <span className="font-bold text-foreground">{formatRub(selectedCalc.price_net || selectedProduct.price)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Маржа:</span>
              <span className={cn(
                'font-bold',
                (selectedCalc.gross_margin_pct ?? 0) >= 15 ? 'text-success' : 'text-warning'
              )}>
                {formatPct(selectedCalc.gross_margin_pct)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Contribution:</span>
              <span className={cn(
                'font-bold',
                (selectedCalc.contribution ?? 0) >= 0 ? 'text-success' : 'text-destructive'
              )}>
                {formatRub(selectedCalc.contribution)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Import competitor */}
      {selectedProduct && (
        <div className="bg-card rounded-[18px] border border-border shadow-warm-sm p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-foreground mb-3">
            Добавить конкурента
          </div>

          <div className="space-y-2">
            <input
              type="text"
              placeholder="SKU конкурента (артикул)"
              value={competitorSku}
              onChange={e => setCompetitorSku(e.target.value)}
              className="w-full h-8 px-3 border border-border rounded-lg bg-secondary/20 text-xs placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              placeholder="Название конкурента / магазина"
              value={competitorName}
              onChange={e => setCompetitorName(e.target.value)}
              className="w-full h-8 px-3 border border-border rounded-lg bg-secondary/20 text-xs placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />

            {error && (
              <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-xs text-destructive">{error}</span>
              </div>
            )}

            <Button
              onClick={handleImportCompetitor}
              disabled={isLoading || !competitorSku || !competitorName}
              className="w-full h-8 text-xs gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3" />
                  Импортировать
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Competitors list */}
      {selectedProduct && productCompetitors.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-foreground px-2">
            Конкуренты ({productCompetitors.length})
          </div>

          {productCompetitors.map(competitor => {
            const ourPrice = selectedCalc?.price_net || selectedProduct.price;
            const competitorPrice = competitor.data.price;
            const priceDiff = ((competitorPrice - ourPrice) / ourPrice) * 100;
            return (
              <Card key={competitor.id} className="p-3 border-border/60 bg-secondary/20">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-foreground">
                      {competitor.name}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {competitor.data.seller_name} • Рейтинг {competitor.data.rating}★
                    </p>
                  </div>
                  <button
                    onClick={() => removeCompetitor(competitor.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors text-xs underline"
                  >
                    Удалить
                  </button>
                </div>

                <div className="space-y-1.5">
                  {/* Price comparison */}
                  <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                    <div className="flex-1">
                      <div className="text-[10px] text-muted-foreground mb-0.5">Цена конкурента</div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-sm text-foreground">
                          {formatRub(competitorPrice)}
                        </span>
                        <span className={cn(
                          'text-[10px] font-semibold flex items-center gap-0.5',
                          priceDiff < 0 ? 'text-success' : 'text-warning'
                        )}>
                          {priceDiff < 0 ? (
                            <>
                              <TrendingDown className="w-3 h-3" />
                              {formatPct(Math.abs(priceDiff))} дешевле
                            </>
                          ) : (
                            <>
                              <TrendingUp className="w-3 h-3" />
                              {formatPct(priceDiff)} дороже
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Commission */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-card/50 rounded-lg">
                      <div className="text-[9px] text-muted-foreground mb-0.5">Наша комиссия</div>
                      <div className="text-xs font-bold text-foreground">
                        {formatPct(selectedProduct.wb_commission_pct || 15)}
                      </div>
                    </div>
                    <div className="p-2 bg-card/50 rounded-lg">
                      <div className="text-[9px] text-muted-foreground mb-0.5">Комиссия конкурента</div>
                      <div className="text-xs font-bold text-foreground">
                        {formatPct(competitor.data.commission_pct)}
                      </div>
                    </div>
                  </div>

                  {/* Analysis */}
                  <div className={cn(
                    'p-2 rounded-lg border',
                    priceDiff < -10
                      ? 'bg-destructive/10 border-destructive/30'
                      : priceDiff < 0
                        ? 'bg-warning/10 border-warning/30'
                        : 'bg-success/10 border-success/30'
                  )}>
                    <div className="text-[9px] text-muted-foreground mb-1">Анализ:</div>
                    <p className="text-[10px] leading-snug text-foreground">
                      {priceDiff < -15 && 'Конкурент существенно дешевле — требуется пересмотр стратегии'}
                      {priceDiff >= -15 && priceDiff < -5 && 'Конкурент дешевле на значимый процент'}
                      {priceDiff >= -5 && priceDiff < 0 && 'Конкурент немного дешевле'}
                      {priceDiff >= 0 && priceDiff <= 10 && 'Цены примерно равны'}
                      {priceDiff > 10 && 'Наша цена выше — хорошее преимущество'}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!selectedProduct && (
        <div className="bg-card rounded-[18px] border border-border shadow-warm-sm p-8 text-center">
          <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Выберите товар для сравнения с конкурентами</p>
        </div>
      )}
    </div>
  );
}
