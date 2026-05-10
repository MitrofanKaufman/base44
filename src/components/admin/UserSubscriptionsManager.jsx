import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Plus, Trash2, Edit2, Save, X, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function UserSubscriptionsManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [newUserForm, setNewUserForm] = useState({ email: '', subscription_id: '', billing_cycle: 'monthly' });
  const [expandedUser, setExpandedUser] = useState(null);

  const { data: userSubscriptions = [] } = useQuery({
    queryKey: ['userSubscriptions'],
    queryFn: () => base44.entities.UserSubscription.list('-created_date', 500)
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => base44.entities.Subscription.list('position')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.UserSubscription.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSubscriptions'] });
      setNewUserForm({ email: '', subscription_id: '', billing_cycle: 'monthly' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.UserSubscription.update(editingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSubscriptions'] });
      setEditingId(null);
      setEditForm(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.UserSubscription.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSubscriptions'] });
    }
  });

  const getSubscriptionName = (subscriptionId) => {
    return subscriptions.find(s => s.id === subscriptionId)?.name || 'Неизвестно';
  };

  const handleCreateUser = async () => {
    if (!newUserForm.email || !newUserForm.subscription_id) {
      alert('Заполните все поля');
      return;
    }

    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    if (newUserForm.billing_cycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    await createMutation.mutateAsync({
      user_email: newUserForm.email,
      subscription_id: newUserForm.subscription_id,
      status: 'active',
      start_date: startDate,
      end_date: endDate.toISOString().split('T')[0],
      billing_cycle: newUserForm.billing_cycle,
      auto_renew: true
    });
  };

  const startEdit = (userSub) => {
    setEditingId(userSub.id);
    setEditForm({ ...userSub });
  };

  const handleSaveEdit = () => {
    if (editForm) {
      updateMutation.mutate(editForm);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-success/10 text-success border-success/30';
      case 'expired':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'cancelled':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      active: 'Активна',
      inactive: 'Неактивна',
      expired: 'Истекла',
      cancelled: 'Отменена'
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* Форма добавления нового пользователя */}
      <Card className="p-4 border-border">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Добавить пользователя</h3>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            placeholder="Email пользователя"
            value={newUserForm.email}
            onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
            className="flex-1 min-w-40 h-9 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={newUserForm.subscription_id}
            onChange={e => setNewUserForm({ ...newUserForm, subscription_id: e.target.value })}
            className="h-9 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Выберите пакет...</option>
            {subscriptions.map(sub => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
          <select
            value={newUserForm.billing_cycle}
            onChange={e => setNewUserForm({ ...newUserForm, billing_cycle: e.target.value })}
            className="h-9 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="monthly">Ежемесячно</option>
            <option value="annual">Ежегодно</option>
          </select>
          <Button
            onClick={handleCreateUser}
            disabled={createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending ? 'Добавление...' : 'Добавить'}
          </Button>
        </div>
      </Card>

      {/* Список пользователей */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">
            Подписки пользователей ({userSubscriptions.length})
          </h3>
        </div>

        {userSubscriptions.map(userSub => {
          const isExpanded = expandedUser === userSub.id;
          const isEditing = editingId === userSub.id;

          if (isEditing && editForm) {
            return (
              <Card key={userSub.id} className="p-4 border-border bg-secondary/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-foreground">{editForm.user_email}</span>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditForm(null);
                    }}
                    className="p-1 hover:bg-secondary rounded"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Пакет</label>
                      <select
                        value={editForm.subscription_id}
                        onChange={e => setEditForm({ ...editForm, subscription_id: e.target.value })}
                        className="w-full h-8 px-2 border border-border rounded text-xs mt-1 focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {subscriptions.map(sub => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Статус</label>
                      <select
                        value={editForm.status}
                        onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full h-8 px-2 border border-border rounded text-xs mt-1 focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="active">Активна</option>
                        <option value="inactive">Неактивна</option>
                        <option value="expired">Истекла</option>
                        <option value="cancelled">Отменена</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Начало</label>
                      <input
                        type="date"
                        value={editForm.start_date}
                        onChange={e => setEditForm({ ...editForm, start_date: e.target.value })}
                        className="w-full h-8 px-2 border border-border rounded text-xs mt-1 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Окончание</label>
                      <input
                        type="date"
                        value={editForm.end_date}
                        onChange={e => setEditForm({ ...editForm, end_date: e.target.value })}
                        className="w-full h-8 px-2 border border-border rounded text-xs mt-1 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Заметки</label>
                    <textarea
                      value={editForm.notes || ''}
                      onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                      className="w-full h-16 px-2 border border-border rounded text-xs mt-1 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      placeholder="Заметки администратора..."
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSaveEdit}
                      disabled={updateMutation.isPending}
                      size="sm"
                      className="flex-1 gap-1"
                    >
                      <Save className="w-3 h-3" />
                      Сохранить
                    </Button>
                    <Button
                      onClick={() => {
                        setEditingId(null);
                        setEditForm(null);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              </Card>
            );
          }

          return (
            <Card
              key={userSub.id}
              className="p-3 border-border hover:shadow-warm-sm transition-all cursor-pointer"
              onClick={() => setExpandedUser(isExpanded ? null : userSub.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{userSub.user_email}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {getSubscriptionName(userSub.subscription_id)}
                    </span>
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded border',
                      getStatusColor(userSub.status)
                    )}>
                      {getStatusLabel(userSub.status)}
                    </span>
                    {userSub.billing_cycle && (
                      <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
                        {userSub.billing_cycle === 'monthly' ? 'Ежемесячно' : 'Ежегодно'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={e => {
                      e.stopPropagation();
                      startEdit(userSub);
                    }}
                    className="h-7 w-7"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={e => {
                      e.stopPropagation();
                      deleteMutation.mutate(userSub.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="h-7 w-7 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                  <ChevronDown className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    isExpanded && 'rotate-180'
                  )} />
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-border/40 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Начало: </span>
                      <span className="font-semibold">{userSub.start_date}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Конец: </span>
                      <span className="font-semibold">{userSub.end_date}</span>
                    </div>
                  </div>
                  {userSub.notes && (
                    <div className="bg-secondary/30 p-2 rounded">
                      <span className="text-muted-foreground">Заметки: </span>
                      <p className="text-foreground mt-1">{userSub.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {userSubscriptions.length === 0 && (
          <div className="text-center p-6 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Нет подписок пользователей</p>
          </div>
        )}
      </div>
    </div>
  );
}