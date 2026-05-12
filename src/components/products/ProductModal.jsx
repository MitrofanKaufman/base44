import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProductModal({ product, projects, clients: _clients, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!product;

  const [form, setForm] = useState({
    name: product?.name || '',
    wb_sku: product?.wb_sku || '',
    project_id: product?.project_id || (projects[0]?.id || ''),
    price: product?.price || '',
    sale_price: product?.sale_price || '',
    wb_commission_pct: product?.wb_commission_pct || '',
    size_length_cm: product?.size_length_cm || '',
    size_width_cm: product?.size_width_cm || '',
    size_height_cm: product?.size_height_cm || '',
    weight_kg: product?.weight_kg || '',
    fulfillment_mode: product?.fulfillment_mode || 'FBO',
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const mut = useMutation({
    mutationFn: (/** @type {any} */ data) => {
      const proj = projectMap[data.project_id];
      const payload = { ...data, client_id: proj?.client_id };
      return isEdit
        ? base44.entities.Product.update(product.id, payload)
        : base44.entities.Product.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); onClose(); },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold">{isEdit ? 'Редактировать товар' : 'Новый товар'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Название товара *</Label>
              <Input className="mt-1" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Чайная пара в подарочной упаковке" />
            </div>
            <div>
              <Label>Артикул WB *</Label>
              <Input className="mt-1 font-mono" value={form.wb_sku} onChange={e => set('wb_sku', e.target.value)} placeholder="123456789" />
            </div>
          </div>

          <div>
            <Label>Проект *</Label>
            <Select value={form.project_id} onValueChange={v => set('project_id', v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Выберите проект" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Цена (₽)</Label>
              <Input className="mt-1" type="number" value={form.price} onChange={e => set('price', +e.target.value)} />
            </div>
            <div>
              <Label>Цена со скидкой (₽)</Label>
              <Input className="mt-1" type="number" value={form.sale_price} onChange={e => set('sale_price', +e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Комиссия WB (%)</Label>
              <Input className="mt-1" type="number" value={form.wb_commission_pct} onChange={e => set('wb_commission_pct', +e.target.value)} />
            </div>
            <div>
              <Label>Схема</Label>
              <Select value={form.fulfillment_mode} onValueChange={v => set('fulfillment_mode', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FBO">FBO</SelectItem>
                  <SelectItem value="FBS">FBS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Габариты</p>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Длина (см)</Label>
              <Input className="mt-1" type="number" value={form.size_length_cm} onChange={e => set('size_length_cm', +e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Ширина (см)</Label>
              <Input className="mt-1" type="number" value={form.size_width_cm} onChange={e => set('size_width_cm', +e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Высота (см)</Label>
              <Input className="mt-1" type="number" value={form.size_height_cm} onChange={e => set('size_height_cm', +e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Вес (кг)</Label>
              <Input className="mt-1" type="number" step="0.1" value={form.weight_kg} onChange={e => set('weight_kg', +e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={() => mut.mutate(form)} disabled={!form.name || !form.wb_sku || !form.project_id || mut.isPending}>
            {mut.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
