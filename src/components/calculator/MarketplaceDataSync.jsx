import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchProductDataFromMarketplace } from '@/lib/MarketplaceAPI';

export default function MarketplaceDataSync({ productId, selectedProduct, onDataUpdate }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error('Product not selected');
      
      const marketplaceData = await fetchProductDataFromMarketplace(productId, 'wildberries');
      return marketplaceData;
    },
    onSuccess: (data) => {
      setStatus('success');
      setError(null);
      
      if (onDataUpdate) {
        onDataUpdate({
          price: data.current_price,
          wb_commission_pct: data.commission_pct
        });
      }
      
      setTimeout(() => setStatus(null), 3000);
    },
    onError: (err) => {
      setStatus('error');
      setError(err.message || 'Ошибка при загрузке данных');
    }
  });

  if (!productId || !selectedProduct) {
    return null;
  }

  const lastSyncTime = selectedProduct?.last_synced_at 
    ? new Date(selectedProduct.last_synced_at).toLocaleTimeString('ru-RU')
    : 'Никогда';

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
        variant="outline"
        size="sm"
        className="gap-2 w-full"
      >
        {syncMutation.isPending ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            Загрузка...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4" />
            Синхронизировать с маркетплейсом
          </>
        )}
      </Button>

      {status === 'success' && (
        <div className="flex items-center gap-2 text-xs text-success bg-success/10 border border-success/20 rounded-lg p-2">
          <CheckCircle className="w-3 h-3 flex-shrink-0" />
          <span>Данные обновлены из маркетплейса</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground px-2">
        Последняя синхронизация: <span className="font-mono">{lastSyncTime}</span>
      </div>
    </div>
  );
}
