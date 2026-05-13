import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { collectWbProductByArticle, fetchWbProductPreview } from '@/lib/MarketplaceAPI';
import { extractWbArticleFromInput } from '@/lib/marketplaceLink';
import { X, Link as LinkIcon, RefreshCw, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRub } from '@/lib/unitEconomics';

function getErrorMessage(error) {
  if (error?.status === 404) return 'Товар не найден. Проверьте ссылку или артикул WB.';
  return error?.message || 'Не удалось собрать товар с маркетплейса.';
}

function buildProductPayload(mapped, article, projectId, clientId) {
  return {
    ...mapped,
    wb_sku: mapped.wb_sku || article,
    project_id: projectId,
    client_id: clientId,
    fulfillment_mode: mapped.fulfillment_mode || 'FBO',
    status: 'active',
    last_synced_at: new Date().toISOString(),
  };
}

export default function WbImportModal({ projects, clients: _clients, onClose }) {
  const qc = useQueryClient();
  const [productLink, setProductLink] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [preview, setPreview] = useState(null);
  const [createdProduct, setCreatedProduct] = useState(null);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  const projectMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);
  const article = useMemo(() => extractWbArticleFromInput(productLink), [productLink]);

  useEffect(() => {
    if (!projectId && projects[0]?.id) setProjectId(projects[0].id);
  }, [projectId, projects]);

  const resetForNewLink = (value) => {
    setProductLink(value);
    setPreview(null);
    setCreatedProduct(null);
    setError('');
    setStatusText('');
  };

  const importMut = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Выберите проект для нового товара.');
      if (!article) throw new Error('Вставьте ссылку на товар Wildberries или артикул WB.');

      const project = projectMap[projectId];
      const clientId = project?.client_id;
      const query = productLink.trim();
      let product = createdProduct;

      if (!product) {
        setStatusText('Получаем карточку с Wildberries...');
        const response = await fetchWbProductPreview(article, { query });
        const mapped = response.mapped || {};
        if (!mapped.name) throw new Error('Товар не найден. Проверьте ссылку или артикул WB.');

        const payload = buildProductPayload(mapped, article, projectId, clientId);
        setPreview(payload);

        setStatusText('Создаём товар...');
        product = await base44.entities.Product.create(payload);
        setCreatedProduct(product);
      }

      setStatusText('Запускаем автоматический сбор...');
      try {
        const collection = await collectWbProductByArticle(article, {
          product_id: product.id,
          project_id: projectId,
          client_id: clientId,
          query,
        });
        return {
          product: collection.persistence?.product || product,
          mapped: collection.mapped || preview,
        };
      } catch (collectionError) {
        collectionError.productCreated = true;
        throw collectionError;
      }
    },
    onMutate: () => {
      setError('');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['product_snapshots'] });
      qc.invalidateQueries({ queryKey: ['marketplace_events'] });
      qc.invalidateQueries({ queryKey: ['raw_marketplace_frames'] });
      onClose();
    },
    onError: (mutationError) => {
      setStatusText('');
      if (mutationError?.productCreated) {
        qc.invalidateQueries({ queryKey: ['products'] });
        setError(`Товар добавлен, но автоматический сбор не завершился: ${getErrorMessage(mutationError)}`);
        return;
      }
      setError(getErrorMessage(mutationError));
    },
  });

  const isBusy = importMut.isPending;
  const buttonLabel = createdProduct ? 'Повторить сбор' : 'Собрать и добавить';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold">Новый товар</h2>
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
            <Label>Ссылка на товар Wildberries</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={productLink}
                onChange={e => resetForNewLink(e.target.value)}
                placeholder="https://www.wildberries.ru/catalog/123456789/detail.aspx"
                onKeyDown={e => e.key === 'Enter' && article && !isBusy && importMut.mutate()}
                className="font-mono text-sm"
              />
            </div>
            <div className="min-h-5 mt-1">
              {article ? (
                <p className="text-xs text-muted-foreground">
                  Артикул WB: <span className="font-mono font-semibold text-foreground">{article}</span>
                </p>
              ) : productLink.trim() ? (
                <p className="text-xs text-destructive">Не удалось распознать артикул WB из ссылки.</p>
              ) : null}
            </div>
          </div>

          {statusText && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg p-3">
              <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
              {statusText}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
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
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm leading-snug">{preview.name}</h3>
                  {preview.category && <p className="text-xs text-muted-foreground mt-0.5">{preview.category}</p>}
                  {preview.sale_price && <p className="text-sm font-bold text-primary mt-1">{formatRub(preview.sale_price)}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {preview.weight_kg && (
                  <div className="bg-card rounded p-2">
                    <p className="text-muted-foreground">Вес</p>
                    <p className="font-semibold">{preview.weight_kg} кг</p>
                  </div>
                )}
                {preview.stock !== undefined && (
                  <div className="bg-card rounded p-2">
                    <p className="text-muted-foreground">Остаток</p>
                    <p className="font-semibold">{preview.stock}</p>
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
                Данные товара получены
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button
            className="flex-1 gap-2"
            onClick={() => importMut.mutate()}
            disabled={!article || !projectId || isBusy}
          >
            {isBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
            {isBusy ? 'Сбор...' : buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
