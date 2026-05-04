import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ClientModal({ 
  client = null, 
  onClose 
}) {
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    status: client?.status || 'active',
    // ... другие поля
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.Client.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (client?.id) {
      updateMut.mutate({ id: client.id, data: formData });
    } else {
      createMut.mutate(formData);
    }
  };

  const isSubmitting = createMut.isLoading || updateMut.isLoading;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {client?.id ? 'Редактировать клиента' : 'Новый клиент'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Название клиента</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="ООО Ромашка"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="client@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Статус</Label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="active">Активен</option>
              <option value="trial">Пробный период</option>
              <option value="inactive">Неактивен</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : client?.id ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}