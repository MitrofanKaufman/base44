import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Package, Pencil, Trash2, RefreshCw, Calculator, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import ProductModal from '@/components/products/ProductModal';
import WbImportModal from '@/components/products/WbImportModal';
import { formatRub } from '@/lib/unitEconomics';

export default function Products() {
  const qc = useQueryClient();
  const [search,    setSearch]    = useState('');
  const [editing,   setEditing]   = useState(null);
  const [creating,  setCreating]  = useState(false);
  const [importing, setImporting] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list()
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.wb_sku?.includes(search)
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">