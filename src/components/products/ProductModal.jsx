import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ProductModal({ 
  product = null, 
  projects = [], 
  clients = [], 
  onClose 
}) {
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    name: product?.name || '',
    wb_sku: product?.wb_sku || '',
    price: product?.price || '',
    sale_price: product?.sale_price || '',
    project_id: product?.project_id || '',
    // ... другие поля
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (product?.id) {
      updateMut.mutate({ id: product.id, data: formData });
    } else {
      createMut.mutate(formData);
    }
  };

  const isSubmitting = createMut.isLoading || updateMut.isLoading;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {product?.id ? 'Редактировать товар' : 'Новый товар'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название товара</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Название товара"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wb_sku">Артикул WB</Label>
              <Input
                id="wb_sku"
                value={formData.wb_sku}
                onChange={(e) => setFormData({ ...formData, wb_sku: e.target.value })}
                placeholder="12345678"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Цена (₽)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale_price">Цена со скидкой (₽)</Label>
              <Input
                id="sale_price"
                type="number"
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_id">Проект</Label>
            <select
              id="project_id"
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Выберите проект</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : product?.id ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}