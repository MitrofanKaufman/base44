import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, FolderOpen, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import ProjectModal from '@/components/projects/ProjectModal';
import { formatRub } from '@/lib/unitEconomics';

const statusConfig = {
  active:    { label: 'Активен',   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  paused:    { label: 'На паузе',  cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  completed: { label: 'Завершён',  cls: 'bg-stone-100 text-stone-500 border border-stone-200' },
  archived:  { label: 'Архив',     cls: 'bg-stone-100 text-stone-400 border border-stone-200' },
};

export default function Projects() {
  const qc = useQueryClient();
  const [search,   setSearch]   = useState('');
  const [editing,  setEditing]  = useState(null);
  const [creating, setCreating] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => base44.entities.Project.list('-created_date'),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn:  () => base44.entities.Client.list(),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Project.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const filtered = projects.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    clientMap[p.client_id]?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Проекты</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{projects.length} проектов</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="gap-2 rounded-md shadow-warm-sm"
          disabled={clients.length === 0}
        >
          <Plus className="w-4 h-4" /> Новый проект
        </Button>
      </div>

      {/* No clients notice */}
      {clients.length === 0 && (
        <div className="flex items-center gap-3 bg-accent border border-border rounded-lg p-4 text-sm text-accent-foreground">
          <AlertCircle className="w-4 h-4 text-primary flex-shrink-0" />
          <span>
            Сначала добавьте хотя бы одного{' '}
            <Link to="/clients" className="underline font-semibold">клиента</Link>.
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9 rounded-md bg-card border-border"
          placeholder="Поиск по проекту или клиенту..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table-like list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="bg-card rounded-lg border border-border h-20 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground bg-card rounded-lg border border-border shadow-warm-sm">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <FolderOpen className="w-6 h-6 opacity-40" />
          </div>
          <p className="font-medium">Нет проектов</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border shadow-warm-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="col-span-5">Проект</div>
            <div className="col-span-3 hidden sm:block">Клиент</div>
            <div className="col-span-2 hidden md:block">Статус</div>
            <div className="col-span-2 text-right hidden sm:block">Пост. расходы</div>
          </div>

          {filtered.map((project, idx) => {
            const client = clientMap[project.client_id];
            const st = statusConfig[project.status] || statusConfig.active;
            return (
              <div
                key={project.id}
                className={`grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-muted/30 transition-colors ${idx !== filtered.length - 1 ? 'border-b border-border' : ''}`}
              >
                {/* Name */}
                <div className="col-span-7 sm:col-span-5 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-[14px] text-foreground truncate">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground truncate">{project.description}</p>
                    )}
                  </div>
                </div>

                {/* Client */}
                <div className="col-span-3 hidden sm:block">
                  {client
                    ? <span className="text-sm text-foreground font-medium">{client.name}</span>
                    : <span className="text-xs text-muted-foreground">—</span>
                  }
                </div>

                {/* Status */}
                <div className="col-span-2 hidden md:block">
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${st.cls}`}>
                    {st.label}
                  </span>
                </div>

                {/* Actions + cost */}
                <div className="col-span-5 sm:col-span-2 flex items-center justify-end gap-3">
                  {project.fixed_monthly > 0 && (
                    <span className="text-sm font-semibold text-foreground hidden sm:block">
                      {formatRub(project.fixed_monthly)}
                    </span>
                  )}
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => setEditing(project)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => { if (confirm('Удалить проект?')) deleteMut.mutate(project.id); }}
                      className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <ProjectModal
          project={editing}
          clients={clients}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}