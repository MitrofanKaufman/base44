import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatRub } from '@/lib/unitEconomics';

export default function CalculationModal({ 
  calculation = null, 
  products = [], 
  projects = [], 
  clients = [], 
  onClose 
}) {
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    name: calculation?.name || '',
    product_id: calculation?.product_id || '',
    project_id: calculation?.project_id || '',
    revenue: calculation?.revenue || '',
    costs: calculation?.costs || '',
    // ... другие поля
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Calculation.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calculations'] });
      onClose();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Calculation.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calculations'] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (calculation?.id) {
      updateMut.mutate({ id: calculation.id, data: formData });
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
            <Calculator className="h-5 w-5" />
            {calculation?.id ? 'Редактировать расчёт' : 'Новый расчёт'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название расчёта</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Расчёт для товара X"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_id">Товар</Label>
              <select
                id="product_id"
                value={formData.product_id}
                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Выберите товар</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="revenue">Выручка (₽)</Label>
              <Input
                id="revenue"
                type="number"
                value={formData.revenue}
                onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                placeholder="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="costs">Затраты (₽)</Label>
              <Input
                id="costs"
                type="number"
                value={formData.costs}
                onChange={(e) => setFormData({ ...formData, costs: e.target.value })}
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : calculation?.id ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}