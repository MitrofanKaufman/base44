import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Calculator, Pencil, Trash2, TrendingUp, TrendingDown, AlertTriangle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { formatRub, formatPct } from '@/lib/unitEconomics';
import CalculationModal from '@/components/calculations/CalculationModal';

export default function Calculations() {
  const qc = useQueryClient();
  const [search,   setSearch]   = useState('');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const urlParams   = new URLSearchParams(window.location.search);
  const preProductId = urlParams.get('product_id');

  useEffect(() => { if (preProductId) setCreating(true); }, [preProductId]);

  const { data: calculations = [], isLoading } = useQuery({
    queryKey: ['calculations'],
    queryFn: () => base44.entities.Calculation.list('-created_date'),
  });

  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Calculation.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calculations'] }),
  });

  const productMap = Object.fromEntries(products.map(p => [p.id, p]));
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const filtered = calculations.filter(c => {
    const prod = productMap[c.product_id];
    return ((property) onSuccess: () => any