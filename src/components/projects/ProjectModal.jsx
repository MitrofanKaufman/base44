import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Field = ({ label, hint = '', children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
    {hint && <p className="text-xs text-muted-foreground -mt-0.5">{hint}</p>}
    {children}
  </div>
);

export default function ProjectModal({ project, clients, onClose }) {
  const qc     = useQueryClient();
  const isEdit = !!project;

  const [form, setForm] = useState({
    name:           project?.name           || '',
    description:    project?.description    || '',
    client_id:      project?.client_id      || clients[0]?.id || '',
    status:         project?.status         || 'active',
    wb_supplier_id: project?.wb_supplier_id || '',
    fixed_monthly:  project?.fixed_monthly  ?? 0,
  });

  const mut = useMutation({
    mutationFn: (/** @type {any} */ data) => isEdit
      ? base44.entities.Project.update(project.id, data)
      : base44.entities.Project.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); onClose(); },
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg border border-border w-full max-w-md shadow-warm-lg">

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-[15px]">{isEdit ? 'Редактировать проект' : 'Новый проект'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <Field label="Название *">
            <Input
              className="rounded-md"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Название кампании"
            />
          </Field>

          <Field label="Описание">
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Краткое описание..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Клиент *">
              <Select value={form.client_id} onValueChange={v => set('client_id', v)}>
                <SelectTrigger className="rounded-md"><SelectValue placeholder="Выберите клиента" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Статус">
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger className="rounded-md"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активен</SelectItem>
                  <SelectItem value="paused">На паузе</SelectItem>
                  <SelectItem value="completed">Завершён</SelectItem>
                  <SelectItem value="archived">Архив</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Пост. расходы / мес (₽)" hint="Фиксированные расходы на проект в месяц">
            <Input
              className="rounded-md"
              type="number"
              value={form.fixed_monthly}
              onChange={e => set('fixed_monthly', +e.target.value)}
              placeholder="0"
            />
          </Field>

          <Field label="ID поставщика WB">
            <Input
              className="rounded-md font-mono text-xs"
              value={form.wb_supplier_id}
              onChange={e => set('wb_supplier_id', e.target.value)}
              placeholder="12345678"
            />
          </Field>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <Button variant="outline" className="flex-1 rounded-md" onClick={onClose}>Отмена</Button>
          <Button
            className="flex-1 rounded-md"
            onClick={() => mut.mutate(form)}
            disabled={!form.name || !form.client_id || mut.isPending}
          >
            {mut.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </div>
    </div>
  );
}
