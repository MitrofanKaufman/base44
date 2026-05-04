import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Search, RefreshCw, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatRub } from '@/lib/unitEconomics';

export default function WbImportModal({ 
  projects = [], 
  clients = [], 
  onClose 
}) {
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
      // Получаем данные товара через LLM (симуляция WB API)
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Получи данные товара Wildberries с артикулом (nmId или vendorCode) "${sku.trim()}".
        Верни реальные данные с сайта WB: название, цена, фото, категория, комиссия, габариты.
        Если товар не найден, верни name: null.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price: { type: 'number' },
            sale_price: { type: 'number' },
            image_url: { type: 'string' },
            category: { type: 'string' },
            wb_commission_pct: { type: 'number' },
            dimensions: {
              type: 'object',
              properties: {
                length: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
                weight: { type: 'number' }
              }
            }
          }
        }
      });

      if (result.name) {
        setPreview(result);
      } else {
        setError('Товар не найден');
      }
    } catch (err) {
      setError('Ошибка при поиске товара');
    } finally {
      setLoading(false);
    }
  };

  const importMut = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
  });

  const handleImport = () => {
    if (!preview || !projectId) return;
    
    const productData = {
      name: preview.name,
      wb_sku: sku.trim(),
      price: preview.price,
      sale_price: preview.sale_price || preview.price,
      project_id: projectId,
      category: preview.category,
      image_url: preview.image_url,
      wb_commission_pct: preview.wb_commission_pct,
      dimensions: preview.dimensions,
    };

    importMut.mutate(productData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Импорт товара с Wildberries
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Поиск товара */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">Артикул WB (nmId или vendorCode)</Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="12345678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project">Проект</Label>
                <select
                  id="project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button 
              onClick={searchProduct} 
              disabled={loading || !sku.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Поиск...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Найти товар
                </>
              )}
            </Button>
          </div>

          {/* Ошибки */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">{error}</span>
            </div>
          )}

          {/* Предпросмотр товара */}
          {preview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">Товар найден</span>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex gap-4">
                  {preview.image_url && (
                    <img 
                      src={preview.image_url} 
                      alt={preview.name}
                      className="w-20 h-20 object-cover rounded-md"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium">{preview.name}</h3>
                    <p className="text-sm text-muted-foreground">{preview.category}</p>
                    <div className="flex gap-4 mt-2">
                      <span className="text-lg font-semibold">{formatRub(preview.price)}</span>
                      {preview.sale_price && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatRub(preview.sale_price)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {preview.wb_commission_pct && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Комиссия WB: </span>
                    <span className="font-medium">{preview.wb_commission_pct}%</span>
                  </div>
                )}

                {preview.dimensions && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Габариты: </span>
                    <span className="font-medium">
                      {preview.dimensions.length}×{preview.dimensions.width}×{preview.dimensions.height} см, {preview.dimensions.weight} г
                    </span>
                  </div>
                )}
              </div>

              <Button 
                onClick={handleImport} 
                disabled={importMut.isLoading || !projectId}
                className="w-full"
              >
                {importMut.isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Импорт...
                  </>
                ) : (
                  'Импортировать товар'
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}