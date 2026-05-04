import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, User, Pencil, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ClientModal from '@/components/clients/ClientModal';

const statusConfig = {
  active:   { label: 'Активен',      icon: CheckCircle, cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  inactive: { label: 'Неактивен',    icon: XCircle,     cls: 'bg-stone-100 text-stone-500 border border-stone-200' },
  trial:    { label: 'Пробный период', icon: Clock,       cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
};

export default function Clients() {
  const qc = useQueryClient();
  const [search,   setSearch]   = useState('');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
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