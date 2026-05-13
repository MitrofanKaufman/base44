import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  MailPlus,
  Play,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createBroadcast,
  createBroadcastSchedule,
  listBroadcasts,
  listBroadcastSchedules,
  runBroadcastSchedule,
  sendBroadcast,
} from '@/lib/adminApi';

const AUDIENCES = [
  { value: 'all', label: 'Все пользователи' },
  { value: 'active_subscribers', label: 'Активные подписчики' },
  { value: 'paid_accounts', label: 'Оплаченные аккаунты' },
  { value: 'admins', label: 'Администраторы' },
];

const CADENCES = [
  { value: 'once', label: 'Один раз' },
  { value: 'daily', label: 'Ежедневно' },
  { value: 'weekly', label: 'Еженедельно' },
  { value: 'subscription_expiring', label: 'Напоминание об окончании подписки' },
];

const CATEGORIES = [
  { value: 'notification', label: 'Уведомление' },
  { value: 'reminder', label: 'Напоминание' },
  { value: 'system', label: 'Системное' },
  { value: 'billing', label: 'Оплата' },
];

function formatDate(value) {
  if (!value) return 'не задано';
  return new Date(value).toLocaleString('ru-RU');
}

function statusLabel(status) {
  return {
    draft: 'Черновик',
    sent: 'Отправлено',
    scheduled: 'Запланировано',
    canceled: 'Отменено',
    active: 'Активно',
    paused: 'Пауза',
  }[status] || status;
}

const SelectField = ({ label, value, onChange, options, disabled = false }) => (
  <label className="space-y-1">
    <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      disabled={disabled}
      className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </label>
);

export default function AdminBroadcasts() {
  const queryClient = useQueryClient();
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    body: '',
    audience: 'all',
    category: 'notification',
  });
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    body: '',
    audience: 'all',
    category: 'reminder',
    cadence: 'once',
    next_run_at: '',
    expiring_in_days: 3,
  });

  const { data: broadcastsData = { items: [] }, isFetching: isFetchingBroadcasts } = useQuery({
    queryKey: ['admin-broadcasts'],
    queryFn: () => listBroadcasts(100),
  });
  const { data: schedulesData = { items: [] }, isFetching: isFetchingSchedules } = useQuery({
    queryKey: ['admin-broadcast-schedules'],
    queryFn: () => listBroadcastSchedules(100),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-broadcasts'] });
    queryClient.invalidateQueries({ queryKey: ['admin-broadcast-schedules'] });
    queryClient.invalidateQueries({ queryKey: ['user-messages'] });
  };

  const createBroadcastMutation = useMutation({
    mutationFn: createBroadcast,
    onSuccess: () => {
      invalidate();
      setBroadcastForm({ title: '', body: '', audience: 'all', category: 'notification' });
    },
  });
  const sendBroadcastMutation = useMutation({
    mutationFn: sendBroadcast,
    onSuccess: invalidate,
  });
  const createScheduleMutation = useMutation({
    mutationFn: createBroadcastSchedule,
    onSuccess: () => {
      invalidate();
      setScheduleForm({
        title: '',
        body: '',
        audience: 'all',
        category: 'reminder',
        cadence: 'once',
        next_run_at: '',
        expiring_in_days: 3,
      });
    },
  });
  const runScheduleMutation = useMutation({
    mutationFn: runBroadcastSchedule,
    onSuccess: invalidate,
  });

  const isBroadcastValid = broadcastForm.title.trim() && broadcastForm.body.trim();
  const isScheduleValid = scheduleForm.title.trim() && scheduleForm.body.trim();
  const broadcasts = broadcastsData.items || [];
  const schedules = schedulesData.items || [];
  const nowLocalInput = useMemo(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 5);
    return date.toISOString().slice(0, 16);
  }, []);

  const handleSaveBroadcast = (sendNow = false) => {
    createBroadcastMutation.mutate({
      ...broadcastForm,
      send_now: sendNow,
    });
  };

  const handleCreateSchedule = () => {
    const nextRunAt = scheduleForm.next_run_at
      ? new Date(scheduleForm.next_run_at).toISOString()
      : new Date().toISOString();
    createScheduleMutation.mutate({
      title: scheduleForm.title,
      body: scheduleForm.body,
      audience: scheduleForm.audience,
      category: scheduleForm.category,
      cadence: scheduleForm.cadence,
      next_run_at: nextRunAt,
      filters: {
        expiring_in_days: Number(scheduleForm.expiring_in_days || 3),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Рассылки и внутренние сообщения</h2>
        <p className="text-sm text-muted-foreground">
          Ручные уведомления, напоминания и автоматические рассылки во внутренний inbox пользователей.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-4 border-border shadow-warm-sm">
          <div className="flex items-center gap-2 mb-4">
            <MailPlus className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Новая рассылка</h3>
          </div>
          <div className="space-y-3">
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground">Заголовок</span>
              <Input
                value={broadcastForm.title}
                onChange={event => setBroadcastForm(form => ({ ...form, title: event.target.value }))}
                placeholder="Например: Обновление тарифов"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground">Сообщение</span>
              <Textarea
                value={broadcastForm.body}
                onChange={event => setBroadcastForm(form => ({ ...form, body: event.target.value }))}
                placeholder="Текст уведомления для пользователей"
                className="min-h-28"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Аудитория"
                value={broadcastForm.audience}
                onChange={value => setBroadcastForm(form => ({ ...form, audience: value }))}
                options={AUDIENCES}
              />
              <SelectField
                label="Тип"
                value={broadcastForm.category}
                onChange={value => setBroadcastForm(form => ({ ...form, category: value }))}
                options={CATEGORIES}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => handleSaveBroadcast(false)}
                disabled={!isBroadcastValid || createBroadcastMutation.isPending}
              >
                Сохранить черновик
              </Button>
              <Button
                onClick={() => handleSaveBroadcast(true)}
                disabled={!isBroadcastValid || createBroadcastMutation.isPending}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                Создать и отправить
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border shadow-warm-sm">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Авторассылка</h3>
          </div>
          <div className="space-y-3">
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground">Заголовок</span>
              <Input
                value={scheduleForm.title}
                onChange={event => setScheduleForm(form => ({ ...form, title: event.target.value }))}
                placeholder="Например: Напоминание о продлении"
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs font-semibold text-muted-foreground">Сообщение</span>
              <Textarea
                value={scheduleForm.body}
                onChange={event => setScheduleForm(form => ({ ...form, body: event.target.value }))}
                placeholder="Текст автоматического уведомления"
                className="min-h-24"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Сценарий"
                value={scheduleForm.cadence}
                onChange={value => setScheduleForm(form => ({
                  ...form,
                  cadence: value,
                  category: value === 'subscription_expiring' ? 'reminder' : form.category,
                }))}
                options={CADENCES}
              />
              <SelectField
                label="Аудитория"
                value={scheduleForm.audience}
                onChange={value => setScheduleForm(form => ({ ...form, audience: value }))}
                options={AUDIENCES}
                disabled={scheduleForm.cadence === 'subscription_expiring'}
              />
              <SelectField
                label="Тип"
                value={scheduleForm.category}
                onChange={value => setScheduleForm(form => ({ ...form, category: value }))}
                options={CATEGORIES}
              />
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Первый запуск</span>
                <Input
                  type="datetime-local"
                  min={nowLocalInput}
                  value={scheduleForm.next_run_at}
                  onChange={event => setScheduleForm(form => ({ ...form, next_run_at: event.target.value }))}
                />
              </label>
              {scheduleForm.cadence === 'subscription_expiring' && (
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">За сколько дней</span>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={scheduleForm.expiring_in_days}
                    onChange={event => setScheduleForm(form => ({ ...form, expiring_in_days: event.target.value }))}
                  />
                </label>
              )}
            </div>
            <Button
              onClick={handleCreateSchedule}
              disabled={!isScheduleValid || createScheduleMutation.isPending}
              className="gap-2"
            >
              <CalendarClock className="w-4 h-4" />
              Создать авторассылку
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-4 border-border shadow-warm-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Рассылки</h3>
            </div>
            {isFetchingBroadcasts && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
          </div>
          <div className="space-y-2">
            {broadcasts.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">Рассылок пока нет</p>
            )}
            {broadcasts.map(broadcast => (
              <div key={broadcast.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-foreground truncate">{broadcast.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{broadcast.body}</p>
                  </div>
                  <Badge variant={broadcast.status === 'sent' ? 'secondary' : 'outline'}>
                    {statusLabel(broadcast.status)}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs text-muted-foreground">
                  <span>{broadcast.audience} · {formatDate(broadcast.created_date)}</span>
                  {broadcast.status !== 'sent' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendBroadcastMutation.mutate(broadcast.id)}
                      disabled={sendBroadcastMutation.isPending}
                      className="h-7 gap-1"
                    >
                      <Send className="w-3 h-3" />
                      Отправить
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 border-border shadow-warm-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Авторассылки</h3>
            </div>
            {isFetchingSchedules && <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />}
          </div>
          <div className="space-y-2">
            {schedules.length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">Авторассылок пока нет</p>
            )}
            {schedules.map(schedule => (
              <div key={schedule.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-foreground truncate">{schedule.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{schedule.body}</p>
                  </div>
                  <Badge variant={schedule.status === 'active' ? 'secondary' : 'outline'}>
                    {statusLabel(schedule.status)}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs text-muted-foreground">
                  <span>Сценарий: {schedule.cadence}</span>
                  <span>Следующий запуск: {formatDate(schedule.next_run_at)}</span>
                </div>
                <div className="flex justify-end mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runScheduleMutation.mutate(schedule.id)}
                    disabled={runScheduleMutation.isPending || schedule.status !== 'active'}
                    className="h-7 gap-1"
                  >
                    <Play className="w-3 h-3" />
                    Запустить сейчас
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
