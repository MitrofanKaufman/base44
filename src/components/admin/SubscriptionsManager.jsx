import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Package, Settings, Trash2, Save, X, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FEATURE_CATEGORIES = {
  products: 'Товары',
  analytics: 'Аналитика',
  automation: 'Автоматизация',
  integrations: 'Интеграции',
  admin: 'Администрирование'
};

const CATEGORY_COLORS = {
  products: 'bg-blue-50 border-blue-200 text-blue-700',
  analytics: 'bg-purple-50 border-purple-200 text-purple-700',
  automation: 'bg-amber-50 border-amber-200 text-amber-700',
  integrations: 'bg-green-50 border-green-200 text-green-700',
  admin: 'bg-red-50 border-red-200 text-red-700'
};

export default function SubscriptionsManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => base44.entities.Subscription.list('position')
  });

  const { data: features = [] } = useQuery({
    queryKey: ['features'],
    queryFn: () => base44.entities.Feature.list('position')
  });

  const featuresByCategory = useMemo(() => {
    const grouped = {};
    Object.keys(FEATURE_CATEGORIES).forEach(cat => {
      grouped[cat] = features.filter(f => f.category === cat);
    });
    return grouped;
  }, [features]);

  const updateSubscriptionMutation = useMutation({
    mutationFn: (data) => base44.entities.Subscription.update(editingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setEditingId(null);
      setEditForm(null);
    }
  });

  const deleteSubscriptionMutation = useMutation({
    mutationFn: (id) => base44.entities.Subscription.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    }
  });

  const startEdit = (subscription) => {
    setEditingId(subscription.id);
    setEditForm({ ...subscription });
  };

  const toggleFeature = (featureId) => {
    if (!editForm) return;
    const features = editForm.features || [];
    if (features.includes(featureId)) {
      setEditForm({
        ...editForm,
        features: features.filter(f => f !== featureId)
      });
    } else {
      setEditForm({
        ...editForm,
        features: [...features, featureId]
      });
    }
  };

  const handleSave = () => {
    if (editForm) {
      updateSubscriptionMutation.mutate(editForm);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm(null);
  };

  if (editingId && editForm) {
    return (
      <div className="space-y-4">
        {/* Редактирование подписки */}
        <Card className="p-4 border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Редактирование: {editForm.name}
            </h2>
            <button
              onClick={handleCancel}
              className="p-1 hover:bg-secondary rounded transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Название</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full h-8 px-2 border border-border rounded mt-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Slug</label>
                <input
                  type="text"
                  value={editForm.slug}
                  disabled={editForm.is_locked}
                  onChange={e => setEditForm({ ...editForm, slug: e.target.value })}
                  className="w-full h-8 px-2 border border-border rounded mt-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Описание</label>
              <textarea
                value={editForm.description || ''}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full h-20 px-2 border border-border rounded mt-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Цена/месяц</label>
                <input
                  type="number"
                  value={editForm.price_monthly}
                  onChange={e => setEditForm({ ...editForm, price_monthly: +e.target.value })}
                  className="w-full h-8 px-2 border border-border rounded mt-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Цена/год</label>
                <input
                  type="number"
                  value={editForm.price_annual}
                  onChange={e => setEditForm({ ...editForm, price_annual: +e.target.value })}
                  className="w-full h-8 px-2 border border-border rounded mt-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Лимиты</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(editForm.limits || {}).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-muted-foreground block mb-1 capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="number"
                      value={value}
                      onChange={e => setEditForm({
                        ...editForm,
                        limits: { ...editForm.limits, [key]: +e.target.value }
                      })}
                      className="w-full h-7 px-2 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Чеклист функций */}
          <div className="border-t border-border pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Функции по категориям</h3>

            {Object.entries(FEATURE_CATEGORIES).map(([categoryKey, categoryName]) => (
              featuresByCategory[categoryKey]?.length > 0 && (
                <div key={categoryKey} className="space-y-2">
                  <div className={cn('px-3 py-2 rounded border text-xs font-semibold', CATEGORY_COLORS[categoryKey])}>
                    {categoryName}
                  </div>

                  <div className="space-y-1.5 ml-2">
                    {featuresByCategory[categoryKey].map(feature => {
                      const isIncluded = (editForm.features || []).includes(feature.id);
                      return (
                        <button
                          key={feature.id}
                          onClick={() => toggleFeature(feature.id)}
                          className="w-full flex items-start gap-2 p-2 rounded hover:bg-secondary/50 transition-colors text-left group"
                        >
                          <div className={cn(
                            'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                            isIncluded
                              ? 'bg-primary border-primary'
                              : 'border-border group-hover:border-primary/50'
                          )}>
                            {isIncluded && (
                              <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground">
                              {feature.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {feature.description}
                            </div>
                            {feature.is_premium && (
                              <div className="text-[9px] text-warning font-semibold mt-0.5">
                                ✨ Premium
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            ))}
          </div>

          {/* Кнопки действия */}
          <div className="flex gap-2 mt-6 pt-4 border-t border-border">
            <Button
              onClick={handleSave}
              disabled={updateSubscriptionMutation.isPending}
              className="flex-1 gap-2"
            >
              {updateSubscriptionMutation.isPending ? (
                <>
                  <div className="w-3 h-3 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Сохранить
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              Отмена
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Список пакетов */}
      <div className="grid gap-3">
        {subscriptions.map(subscription => (
          <Card
            key={subscription.id}
            className="p-4 border-border hover:shadow-warm-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground">{subscription.name}</h3>
                  {subscription.is_default && (
                    <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-1 rounded">
                      По умолчанию
                    </span>
                  )}
                  {subscription.is_locked && (
                    <span className="text-[9px] font-bold bg-warning/10 text-warning px-2 py-1 rounded">
                      Заблокирован
                    </span>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-2">{subscription.description}</p>

                <div className="flex flex-wrap gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Цена: </span>
                    <span className="font-semibold text-foreground">
                      {subscription.price_monthly === 0 ? 'Бесплатно' : `${subscription.price_monthly}₽/мес`}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Функций: </span>
                    <span className="font-semibold text-foreground">
                      {subscription.features?.length || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Товаров: </span>
                    <span className="font-semibold text-foreground">
                      до {subscription.limits?.products_count || '∞'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => startEdit(subscription)}
                  className="h-8 w-8"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                {!subscription.is_locked && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => deleteSubscriptionMutation.mutate(subscription.id)}
                    disabled={deleteSubscriptionMutation.isPending}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}