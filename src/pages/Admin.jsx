import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Shield, AlertTriangle, ChevronRight } from 'lucide-react';
import AdminHomepage from '@/components/admin/AdminHomepage';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminDocumentation from '@/components/admin/AdminDocumentation';
import AdminSwagger from '@/components/admin/AdminSwagger';
import AdminEvents from '@/components/admin/AdminEvents';
import AdminRawFrames from '@/components/admin/AdminRawFrames';
import AdminDeadLetters from '@/components/admin/AdminDeadLetters';
import AdminSnapshots from '@/components/admin/AdminSnapshots';
import AdminSettings from '@/components/admin/AdminSettings';
import AdminCollectionRunner from '@/components/admin/AdminCollectionRunner';
import AdminScheduledTasks from '@/components/admin/AdminScheduledTasks';
import SubscriptionsManager from '@/components/admin/SubscriptionsManager';
import UserSubscriptionsManager from '@/components/admin/UserSubscriptionsManager';
import SyncStatusWidget from '@/components/admin/SyncStatusWidget';
import AdminBroadcasts from '@/components/admin/AdminBroadcasts';

const TAB_LABELS = {
  'overview': 'Обзор',
  'wb-sync': 'WB Синхронизация',
  'subscriptions': 'Пакеты подписок',
  'user-subscriptions': 'Подписки пользователей',
  'collection-runner': 'Прогон сбора',
  'scheduled-tasks': 'Расписание',
  'broadcasts': 'Рассылки',
  'documentation': 'Документация',
  'swagger': 'API',
  'events': 'События',
  'raw-frames': 'Raw Frames',
  'dead-letters': 'Ошибки',
  'snapshots': 'Снимки',
};

export default function Admin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(null);

  const isAdmin = user && (user.role === 'admin' || user.role === 'administrator' || user.role === 'owner');
  
  if (!user || !isAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-red-900 mb-2">Доступ запрещён</h1>
          <p className="text-red-700">Администраторский раздел доступен только администраторам.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header с хлебными крошками */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Администрирование</h1>
          </div>
          
          {/* Хлебные крошки */}
          {activeTab && (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setActiveTab(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Главная
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground font-medium">{TAB_LABELS[activeTab]}</span>
            </div>
          )}
          
          {!activeTab && (
            <p className="text-sm text-muted-foreground">Управление маркетплейс-ядром</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto p-4">
        {!activeTab && <AdminHomepage onSelectSection={setActiveTab} />}
        {activeTab === 'overview' && <AdminOverview />}
        {activeTab === 'wb-sync' && (
          <div className="max-w-xl">
            <SyncStatusWidget />
          </div>
        )}
        {activeTab === 'subscriptions' && <SubscriptionsManager />}
        {activeTab === 'user-subscriptions' && <UserSubscriptionsManager />}
        {activeTab === 'collection-runner' && <AdminCollectionRunner />}
        {activeTab === 'scheduled-tasks' && <AdminScheduledTasks />}
        {activeTab === 'broadcasts' && <AdminBroadcasts />}
        {activeTab === 'documentation' && <AdminDocumentation />}
        {activeTab === 'swagger' && <AdminSwagger />}
        {activeTab === 'events' && <AdminEvents />}
        {activeTab === 'raw-frames' && <AdminRawFrames />}
        {activeTab === 'dead-letters' && <AdminDeadLetters />}
        {activeTab === 'snapshots' && <AdminSnapshots />}
        {activeTab === 'settings' && <AdminSettings />}
      </div>
    </div>
  );
}
