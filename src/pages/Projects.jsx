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
  completed: { label: 'Завершён', cls: 'bg-stone-100 text-stone-500 border border-stone-200' },
  archived:  { label: 'Архив',     cls: 'bg-stone-100 text-stone-400 border border-stone-200' },
};

export default function Projects() {
  const qc = useQueryClient();
  const [search,   setSearch]   = useState('');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date'),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Project.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const filtered = projects.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||