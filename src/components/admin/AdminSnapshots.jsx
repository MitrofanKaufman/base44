import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminSnapshots() {
  const { data: products = [] } = useQuery({
    queryKey: ['product_snapshots'],
    queryFn: () => base44.entities.ProductSnapshot.list(),
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ['seller_snapshots'],
    queryFn: () => base44.entities.SellerSnapshot.list(),
  });

  return (
    <Tabs defaultValue="products" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="products">Товары ({products.length})</TabsTrigger>
        <TabsTrigger value="sellers">Продавцы ({sellers.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="products" className="space-y-3">
        {products.length === 0 ? (
          <div className="bg-secondary/30 rounded-lg p-6 text-center text-muted-foreground">Нет снимков товаров</div>
        ) : (
          products.map(p => (
            <div key={p.id} className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.source} / SKU: {p.sku}</div>
                </div>
                <div className="font-mono font-bold text-lg">{p.price}₽</div>
              </div>
            </div>
          ))
        )}
      </TabsContent>

      <TabsContent value="sellers" className="space-y-3">
        {sellers.length === 0 ? (
          <div className="bg-secondary/30 rounded-lg p-6 text-center text-muted-foreground">Нет снимков продавцов</div>
        ) : (
          sellers.map(s => (
            <div key={s.id} className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-foreground">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.source}</div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-lg font-bold text-yellow-500">★</span>
                  <span className="font-semibold">{s.rating}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </TabsContent>
    </Tabs>
  );
}