import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, User, Pencil, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ClientModal from '@/components/clients/ClientModal';

const statusConfig = {
  active:   { label: 'Активен',       icon: CheckCircle, cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  inactive: { label: 'Неактивен',     icon: XCircle,     cls: 'bg-stone-100 text-stone-500 border border-stone-200' },
  trial:    { label: 'Пробный период', icon: Clock,       cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
};

export default function Clients() {
  const qc = useQueryClient();
  const [search,   setSearch]   = useState('');
  const [editing,  setEditing]  = useState(null);
  const [creating, setCreating] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn:  () => base44.entities.Client.list('-created_date'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Клиенты</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{clients.length} клиентов</p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2 rounded-md shadow-warm-sm">
          <Plus className="w-4 h-4" /> Добавить клиента
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 rounded-md bg-card border-border"
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-card rounded-lg border border-border h-44 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground bg-card rounded-lg border border-border shadow-warm-sm">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <User className="w-6 h-6 opacity-40" />
          </div>
          <p className="font-medium">Нет клиентов</p>
          <p className="text-sm mt-1">Добавьте первого клиента</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(client => {
            const st = statusConfig[client.status] || statusConfig.active;
            const StatusIcon = st.icon;
            return (
              <div
                key={client.id}
                className="bg-card rounded-lg border border-border p-5 shadow-warm-sm hover:shadow-warm transition-shadow flex flex-col gap-4"
              >
                {/* Top row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-primary font-semibold text-sm">
                      {client.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-[15px] leading-tight">{client.name}</h3>
                      {client.email && <p className="text-xs text-muted-foreground mt-0.5">{client.email}</p>}
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => setEditing(client)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Удалить клиента?')) deleteMut.mutate(client.id); }}
                      className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>

                {/* Bottom row */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${st.cls}`}>
                    <StatusIcon className="w-3 h-3" />
                    {st.label}
                  </span>
                  {client.phone && (
                    <span className="text-xs text-muted-foreground">{client.phone}</span>
                  )}
                </div>

                {client.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t border-border">{client.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <ClientModal
          client={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}