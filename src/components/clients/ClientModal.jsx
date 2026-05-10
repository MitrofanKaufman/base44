import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
    {children}
  </div>
);

export default function ClientModal({ client, onClose }) {
  const qc     = useQueryClient();
  const isEdit = !!client;

  const [form, setForm] = useState({
    name:          client?.name          || '',
    email:         client?.email         || '',
    phone:         client?.phone         || '',
    status:        client?.status        || 'active',
    wb_api_token:  client?.wb_api_token  || '',
    notes:         client?.notes         || '',
  });

  const mut = useMutation({
    mutationFn: (data) => isEdit
      ? base44.entities.Client.update(client.id, data)
      : base44.entities.Client.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); onClose(); },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg border border-border w-full max-w-md shadow-warm-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">{isEdit ? 'Редактировать клиента' : 'Новый клиент'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <Field label="Название / Имя *">
            <Input
              className="rounded-md"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="ООО Ромашка"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input className="rounded-md" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="client@email.com" />
            </Field>
            <Field label="Телефон">
              <Input className="rounded-md" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+7 999 000 00 00" />
            </Field>
          </div>

          <Field label="Статус">
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger className="rounded-md"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Активен</SelectItem>
                <SelectItem value="trial">Пробный период</SelectItem>
                <SelectItem value="inactive">Неактивен</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="WB API Token (статистика)">
            <Input
              className="rounded-md font-mono text-xs"
              value={form.wb_api_token}
              onChange={e => set('wb_api_token', e.target.value)}
              placeholder="eyJhbGci..."
            />
          </Field>

          <Field label="Заметки">
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Дополнительная информация..."
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" className="flex-1 rounded-md" onClick={onClose}>Отмена</Button>
          <Button
            className="flex-1 rounded-md"
            onClick={() => mut.mutate(form)}
            disabled={!form.name || mut.isPending}
          >
            {mut.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </div>
    </div>
  );
}