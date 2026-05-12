import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MonitorCog,
  RefreshCcw,
  Save,
  Shield,
  SlidersHorizontal,
  User,
  UserCog,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isUser1Account } from '@/lib/AdminInitializer';
import { DEFAULT_FEATURES, getUserSubscription } from '@/lib/subscriptionService';
import { DEFAULT_USER_SETTINGS, loadUserSettings, saveUserSettings } from '@/lib/userSettingsService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const ROLE_LABELS = {
  admin: 'Администратор',
  administrator: 'Администратор',
  owner: 'Владелец',
  user: 'Пользователь',
};

const NOTIFICATION_OPTIONS = [
  {
    key: 'weeklyReports',
    title: 'Еженедельные отчеты',
    description: 'Краткая сводка по продажам, марже и изменению цен.',
  },
  {
    key: 'marginAlerts',
    title: 'Алерты по маржинальности',
    description: 'Показывать предупреждения, когда маржа уходит ниже безопасного уровня.',
  },
  {
    key: 'syncFailures',
    title: 'Ошибки синхронизации',
    description: 'Сообщать о сбоях WB/Ozon/Yandex импорта и фоновых задач.',
  },
  {
    key: 'taskDigest',
    title: 'Дайджест очередей',
    description: 'Показывать краткий обзор выполненных и ожидающих задач.',
  },
];

const UI_OPTIONS = [
  {
    key: 'compactMode',
    title: 'Компактный режим',
    description: 'Уменьшенные отступы в аналитических блоках и формах.',
  },
  {
    key: 'denseTables',
    title: 'Плотные таблицы',
    description: 'Больше строк на экране для клиентов, проектов и товаров.',
  },
  {
    key: 'showHints',
    title: 'Подсказки в интерфейсе',
    description: 'Показывать пояснения рядом с расчетами и настройками.',
  },
];

const PERIOD_OPTIONS = [
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
];

const FEATURE_LABELS = new Map(DEFAULT_FEATURES.map((feature) => [feature.slug, feature.name]));

function getUserKey(user) {
  return user?.id || user?.email || 'anonymous';
}

function getInitials(user) {
  const source = user?.full_name || user?.email || 'U';
  return source
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function isAdminUser(user) {
  return ['admin', 'administrator', 'owner'].includes(user?.role) || isUser1Account(user);
}

function getRoleLabel(user) {
  if (isAdminUser(user)) {
    return 'Администратор';
  }

  return ROLE_LABELS[user?.role] || user?.role || 'Пользователь';
}

function formatDate(value) {
  if (!value) {
    return 'Не указано';
  }

  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch (_error) {
    return String(value);
  }
}

function InfoTile({ icon: Icon, title, value, description = '' }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-warm-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
          {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
    </div>
  );
}

function SettingSwitch({ title, description, checked, onCheckedChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-warm-sm">
        <Icon className="size-4" />
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FeatureList({ subscription }) {
  const features = Array.isArray(subscription?.features) ? subscription.features : [];

  if (features.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Данные о функциях подписки пока недоступны. Доступ определяется backend API и текущей ролью пользователя.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {features.slice(0, 10).map((feature) => (
        <div key={feature} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
          <CheckCircle2 className="size-4 shrink-0 text-success" />
          <span className="truncate text-sm font-medium text-foreground">
            {FEATURE_LABELS.get(feature) || feature}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Settings() {
  const { user, logout, checkUserAuth, authError } = useAuth();
  const userKey = getUserKey(user);
  const isAdmin = isAdminUser(user);

  const [activeTab, setActiveTab] = useState('profile');
  const [profileName, setProfileName] = useState(user?.full_name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [settings, setSettings] = useState(() => loadUserSettings(userKey));
  const [subscription, setSubscription] = useState(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState(null);

  useEffect(() => {
    setProfileName(user?.full_name || '');
    setSettings(loadUserSettings(getUserKey(user)));
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      if (!user?.email) {
        setSubscription(null);
        return;
      }

      setIsLoadingSubscription(true);
      setSubscriptionError(null);

      try {
        const result = await getUserSubscription(user.email);
        if (!cancelled) {
          setSubscription(result || null);
        }
      } catch (error) {
        if (!cancelled) {
          setSubscription(null);
          setSubscriptionError(error?.message || 'Не удалось загрузить подписку');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSubscription(false);
        }
      }
    }

    loadSubscription();

    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  const saveSettingsPatch = (patch) => {
    try {
      const nextSettings = saveUserSettings(userKey, patch);
      setSettings(nextSettings);
    } catch (error) {
      toast({
        title: 'Настройки не сохранены',
        description: error?.message || 'Проверьте доступность локального хранилища браузера.',
        variant: 'destructive',
      });
    }
  };

  const handleNotificationChange = (key, checked) => {
    saveSettingsPatch({
      notifications: {
        ...settings.notifications,
        [key]: checked,
      },
    });
  };

  const handleUiChange = (key, checked) => {
    saveSettingsPatch({
      ui: {
        ...settings.ui,
        [key]: checked,
      },
    });
  };

  const handlePeriodChange = (defaultPeriod) => {
    saveSettingsPatch({
      dashboard: {
        ...settings.dashboard,
        defaultPeriod,
      },
    });
  };

  const handleResetSettings = () => {
    const resetSettings = saveUserSettings(userKey, {
      ...DEFAULT_USER_SETTINGS,
      updatedAt: new Date().toISOString(),
    });
    setSettings(resetSettings);
    toast({
      title: 'Настройки сброшены',
      description: 'Локальные предпочтения пользователя возвращены к значениям по умолчанию.',
    });
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();

    const fullName = profileName.trim();

    if (!fullName) {
      toast({
        title: 'Имя не сохранено',
        description: 'Укажите имя пользователя перед сохранением профиля.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingProfile(true);

    try {
      await base44.auth.updateMe({ full_name: fullName });
      await checkUserAuth();
      toast({
        title: 'Профиль обновлен',
      description: 'Имя пользователя сохранено.',
      });
    } catch (error) {
      toast({
        title: 'Профиль не обновлен',
        description: error?.message || 'Backend API не разрешил изменить данные текущего пользователя.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 rounded-[22px] border border-border bg-card p-5 shadow-warm-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-14 border border-border shadow-warm-sm">
            <AvatarFallback className="bg-primary text-base font-semibold text-primary-foreground">
              {getInitials(user)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Настройки пользователя</h1>
              <Badge variant={isAdmin ? 'default' : 'secondary'} className="rounded-full">
                {getRoleLabel(user)}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {user?.email || 'Email не указан'} · локальные настройки и профиль пользователя
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => checkUserAuth()} className="rounded-md">
            <RefreshCcw className="size-4" />
            Обновить сессию
          </Button>
          <Button variant="secondary" onClick={() => logout()} className="rounded-md">
            <LogOut className="size-4" />
            Выйти
          </Button>
        </div>
      </div>

      {authError && (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <AlertTriangle className="size-4" />
          <AlertTitle>Проблема авторизации</AlertTitle>
          <AlertDescription>
            {authError.message || 'Сессия требует повторного входа. Выйдите из аккаунта и авторизуйтесь заново.'}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
        <TabsList className="grid h-auto grid-cols-2 gap-1 rounded-[18px] border border-border bg-card p-1 shadow-warm-sm md:grid-cols-5">
          <TabsTrigger value="profile" className="gap-2 rounded-xl py-2">
            <User className="size-4" />
            Профиль
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 rounded-xl py-2">
            <KeyRound className="size-4" />
            Безопасность
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2 rounded-xl py-2">
            <Shield className="size-4" />
            Доступ
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 rounded-xl py-2">
            <Bell className="size-4" />
            Уведомления
          </TabsTrigger>
          <TabsTrigger value="interface" className="gap-2 rounded-xl py-2">
            <MonitorCog className="size-4" />
            Интерфейс
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="m-0">
          <Card className="rounded-[22px] border-border shadow-warm-sm">
            <CardHeader>
              <SectionHeader
                icon={UserCog}
                title="Профиль"
                description="Основные данные текущего пользователя. Email заблокирован до появления подтвержденного flow смены адреса."
              />
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSave} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
                  <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/50 p-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="full-name">Имя пользователя</Label>
                      <Input
                        id="full-name"
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                        placeholder="Введите имя"
                        className="bg-card"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" value={user?.email || ''} disabled readOnly className="bg-muted/50" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <InfoTile icon={Mail} title="Email" value={user?.email || 'Не указан'} />
                    <InfoTile icon={Shield} title="Роль" value={getRoleLabel(user)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <InfoTile icon={Database} title="ID" value={user?.id || 'Не указан'} />
                  <InfoTile icon={CalendarClock} title="Создан" value={formatDate(user?.created_date)} />
                  <InfoTile icon={CalendarClock} title="Обновлен" value={formatDate(user?.updated_date)} />
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Сохранение профиля идет через локальный backend API. Если API вернет отказ, страница останется в режиме просмотра.
                  </p>
                  <Button type="submit" disabled={isSavingProfile} className="rounded-md shadow-warm-sm">
                    {isSavingProfile ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Сохранить профиль
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="m-0">
          <Card className="rounded-[22px] border-border shadow-warm-sm">
            <CardHeader>
              <SectionHeader
                icon={KeyRound}
                title="Безопасность"
                description="Текущая сессия управляется локальным JWT/cookie backend. Пароль и 2FA здесь отображаются как read-only блоки."
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <InfoTile icon={CheckCircle2} title="Сессия" value="Активна" description="Пользователь прошел backend auth check." />
                <InfoTile icon={Mail} title="Аккаунт" value={user?.email || 'Не указан'} />
                <InfoTile icon={CalendarClock} title="Последняя проверка" value={formatDate(new Date().toISOString())} />
              </div>

              <Alert className="border-amber-200 bg-amber-50 text-amber-950">
                <AlertTriangle className="size-4" />
                <AlertTitle>Ограничения текущего auth flow</AlertTitle>
                <AlertDescription>
                  Смена пароля, 2FA и управление устройствами пока не подключены к интерфейсу.
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border border-border bg-background/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Завершить текущую сессию</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Выход очистит текущую JWT/cookie сессию.
                    </p>
                  </div>
                  <Button variant="destructive" onClick={() => logout()} className="rounded-md">
                    <LogOut className="size-4" />
                    Выйти из аккаунта
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="m-0">
          <Card className="rounded-[22px] border-border shadow-warm-sm">
            <CardHeader>
              <SectionHeader
                icon={Shield}
                title="Доступ и подписка"
                description="Роль, admin-статус, пакет подписки и доступные функции текущего пользователя."
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <InfoTile
                  icon={BadgeCheck}
                  title="Admin status"
                  value={isAdmin ? 'Администратор' : 'Пользователь'}
                  description={isUser1Account(user) ? 'Аккаунт user1 получает admin-права автоматически.' : 'Определяется ролью Base44.'}
                />
                <InfoTile icon={Shield} title="Роль" value={user?.role || 'Не указана'} />
                <InfoTile
                  icon={SlidersHorizontal}
                  title="Пакет"
                  value={isLoadingSubscription ? 'Загрузка...' : subscription?.name || 'Базовый доступ'}
                />
              </div>

              {subscriptionError && (
                <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Подписка не загружена</AlertTitle>
                  <AlertDescription>{subscriptionError}</AlertDescription>
                </Alert>
              )}

              <div className="rounded-lg border border-border bg-background/50 p-4">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Доступные функции</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Список берется из активной подписки. Админ-панель дополнительно контролируется ролью.
                    </p>
                  </div>
                  <Badge variant={isAdmin ? 'default' : 'secondary'} className="w-fit rounded-full">
                    {isAdmin ? 'Admin menu enabled' : 'Admin menu hidden'}
                  </Badge>
                </div>
                {isLoadingSubscription ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Загрузка подписки...
                  </div>
                ) : (
                  <FeatureList subscription={subscription} />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="m-0">
          <Card className="rounded-[22px] border-border shadow-warm-sm">
            <CardHeader>
              <SectionHeader
                icon={Bell}
                title="Уведомления"
                description="Локальные предпочтения отображения уведомлений. Реальная email/push доставка будет подключаться отдельно."
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {NOTIFICATION_OPTIONS.map((option) => (
                  <SettingSwitch
                    key={option.key}
                    title={option.title}
                    description={option.description}
                    checked={Boolean(settings.notifications?.[option.key])}
                    onCheckedChange={(checked) => handleNotificationChange(option.key, checked)}
                  />
                ))}
              </div>

              <Separator />

              <div className="text-xs text-muted-foreground">
                Последнее локальное сохранение: {formatDate(settings.updatedAt)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interface" className="m-0">
          <Card className="rounded-[22px] border-border shadow-warm-sm">
            <CardHeader>
              <SectionHeader
                icon={MonitorCog}
                title="Интерфейс"
                description="Персональные UI-настройки для рабочего пространства Velocis."
              />
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {UI_OPTIONS.map((option) => (
                  <SettingSwitch
                    key={option.key}
                    title={option.title}
                    description={option.description}
                    checked={Boolean(settings.ui?.[option.key])}
                    onCheckedChange={(checked) => handleUiChange(option.key, checked)}
                  />
                ))}
              </div>

              <div className="rounded-lg border border-border bg-background/50 p-4">
                <p className="text-sm font-semibold text-foreground">Период дашборда по умолчанию</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Значение сохраняется локально и готово к подключению к dashboard-фильтрам.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {PERIOD_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={settings.dashboard?.defaultPeriod === option.value ? 'default' : 'outline'}
                      onClick={() => handlePeriodChange(option.value)}
                      className={cn('rounded-md', settings.dashboard?.defaultPeriod === option.value && 'shadow-warm-sm')}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Сбросить локальные предпочтения</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Будут восстановлены значения по умолчанию для уведомлений, интерфейса и dashboard.
                  </p>
                </div>
                <Button type="button" variant="outline" onClick={handleResetSettings} className="rounded-md">
                  <RefreshCcw className="size-4" />
                  Сбросить настройки
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
