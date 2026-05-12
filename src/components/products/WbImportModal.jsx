import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { fetchWbProductPreview } from '@/lib/MarketplaceAPI';
import { X, Search, RefreshCw, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRub } from '@/lib/unitEconomics';

export default function WbImportModal({ projects, clients: _clients, onClose }) {
  const qc = useQueryClient();
  const [sku, setSku] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const searchProduct = async () => {
    if (!sku.trim()) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const response = await fetchWbProductPreview(sku.trim());
      const result = response.mapped || {};
      if (!result.name) {
        setError('Товар не найден. Проверьте артикул.');
      } else {
        setPreview(result);
      }
    } catch {
      setError('Ошибка при поиске товара.');
    }
    setLoading(false);
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const proj = projectMap[projectId];
      return base44.entities.Product.create({
        ...preview,
        wb_sku: sku.trim(),
        project_id: projectId,
        client_id: proj?.client_id,
        last_synced_at: new Date().toISOString(),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">Импорт товара с Wildberries</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <Label>Проект</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Выберите проект" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Артикул WB (nmId или vendorCode)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="123456789"
                onKeyDown={e => e.key === 'Enter' && searchProduct()}
                className="font-mono"
              />
              <Button onClick={searchProduct} disabled={loading || !sku.trim()} className="gap-2 flex-shrink-0">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Найти
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {preview && (
            <div className="bg-muted/50 rounded-xl border border-border p-4 space-y-3">
              <div className="flex gap-3">
                {preview.image_url ? (
                  <img src={preview.image_url} alt={preview.name} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-sm">{preview.name}</h3>
                  {preview.category && <p className="text-xs text-muted-foreground">{preview.category}</p>}
                  {preview.sale_price && <p className="text-sm font-bold text-primary mt-1">{formatRub(preview.sale_price)}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {preview.wb_commission_pct && (
                  <div className="bg-card rounded p-2">
                    <p className="text-muted-foreground">Комиссия WB</p>
                    <p className="font-semibold">{preview.wb_commission_pct}%</p>
                  </div>
                )}
                {preview.weight_kg && (
                  <div className="bg-card rounded p-2">
                    <p className="text-muted-foreground">Вес</p>
                    <p className="font-semibold">{preview.weight_kg} кг</p>
                  </div>
                )}
                {preview.size_length_cm && (
                  <div className="bg-card rounded p-2 col-span-2">
                    <p className="text-muted-foreground">Габариты</p>
                    <p className="font-semibold">{preview.size_length_cm} × {preview.size_width_cm} × {preview.size_height_cm} см</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle className="w-3.5 h-3.5" />
                Товар найден, готов к импорту
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={() => saveMut.mutate()} disabled={!preview || !projectId || saveMut.isPending}>
            {saveMut.isPending ? 'Импорт...' : 'Импортировать'}
          </Button>
        </div>
      </div>
    </div>
  );
}
