import { BarChart3, Zap, Shield, Users, BookOpen, FileText, Server, AlertTriangle, BarChart, Sparkles, ArrowRight, MailPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'overview', label: 'Обзор', icon: BarChart3, gradient: 'from-blue-500 to-cyan-500', desc: 'Ключевые метрики системы' },
  { id: 'wb-sync', label: 'WB Синхронизация', icon: Zap, gradient: 'from-yellow-500 to-orange-500', desc: 'Статус и управление синхро' },
  { id: 'collection-runner', label: 'Прогон сбора', icon: Sparkles, gradient: 'from-purple-500 to-pink-500', desc: 'Запуск collection pipeline' },
  { id: 'subscriptions', label: 'Пакеты подписок', icon: Shield, gradient: 'from-indigo-500 to-purple-500', desc: 'Тарифные планы' },
  { id: 'user-subscriptions', label: 'Подписки', icon: Users, gradient: 'from-pink-500 to-rose-500', desc: 'Пользовательские подписки' },
  { id: 'scheduled-tasks', label: 'Расписание', icon: BarChart, gradient: 'from-emerald-500 to-teal-500', desc: 'Фоновые задачи' },
  { id: 'broadcasts', label: 'Рассылки', icon: MailPlus, gradient: 'from-sky-500 to-indigo-500', desc: 'Сообщения и автонапоминания' },
  { id: 'dead-letters', label: 'Ошибки', icon: AlertTriangle, gradient: 'from-red-500 to-orange-500', desc: 'Обработка ошибок' },
  { id: 'events', label: 'События', icon: Server, gradient: 'from-teal-500 to-cyan-500', desc: 'Marketplace события' },
];

const TOOLS = [
  { id: 'documentation', label: 'Документация', icon: BookOpen, desc: 'API и руководства' },
  { id: 'swagger', label: 'Swagger/OpenAPI', icon: FileText, desc: 'Интерактивная спецификация' },
  { id: 'raw-frames', label: 'Raw Frames', icon: Server, desc: 'Необработанные данные' },
  { id: 'snapshots', label: 'Snapshots', icon: BarChart3, desc: 'Снимки данных' },
];

const SectionCard = ({ section, onClick }) => {
  const Icon = section.icon;
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:scale-105"
    >
      {/* Градиентный фон */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-90 group-hover:opacity-100 transition-opacity',
        `from-${section.gradient.split(' ')[1]} to-${section.gradient.split(' ')[3]}`
      )} style={{
        backgroundImage: `linear-gradient(135deg, ${section.gradient.includes('blue') ? '#3b82f6' : section.gradient.includes('yellow') ? '#eab308' : section.gradient.includes('purple') ? '#a855f7' : section.gradient.includes('indigo') ? '#6366f1' : section.gradient.includes('pink') ? '#ec4899' : section.gradient.includes('emerald') ? '#10b981' : section.gradient.includes('red') ? '#ef4444' : '#14b8a6'}, ${section.gradient.includes('cyan') ? '#06b6d4' : section.gradient.includes('orange') ? '#f97316' : section.gradient.includes('rose') ? '#f43f5e' : section.gradient.includes('teal') ? '#14b8a6' : '#0ea5e9'})`
      }}>
        {/* Орнамент */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-20 group-hover:scale-150 transition-transform" style={{
          background: 'radial-gradient(circle, white 0%, transparent 70%)'
        }} />
      </div>

      {/* Контент */}
      <div className="relative z-10">
        <div className="mb-4 inline-flex p-3 rounded-xl bg-white/20 backdrop-blur-sm">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1.5">{section.label}</h3>
        <p className="text-sm text-white/80 mb-4">{section.desc}</p>
        <div className="flex items-center gap-1 text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Открыть <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
};

export default function AdminHomepage({ onSelectSection }) {
  return (
    <div className="space-y-8">
      {/* Героический заголовок */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-primary">Маркетплейс-ядро</span>
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-3">Администрирование системы</h1>
        <p className="text-base text-muted-foreground">Управление ядром маркетплейса, синхронизацией данных и подписками</p>
      </div>

      {/* Основные разделы */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Основные функции</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SECTIONS.map(section => (
            <SectionCard
              key={section.id}
              section={section}
              onClick={() => onSelectSection(section.id)}
            />
          ))}
        </div>
      </div>

      {/* Дополнительные инструменты */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Инструменты и справочники</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TOOLS.map(tool => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onSelectSection(tool.id)}
                className="p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 hover:border-primary/40 transition-all group"
              >
                <div className="inline-flex p-2 rounded-lg bg-secondary mb-3 group-hover:bg-primary/10">
                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <h4 className="font-semibold text-sm text-foreground mb-1">{tool.label}</h4>
                <p className="text-xs text-muted-foreground">{tool.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Быстрый старт */}
      <div className="rounded-2xl border border-border bg-gradient-to-r from-primary/5 to-accent/5 p-8">
        <div className="max-w-2xl">
          <h3 className="text-xl font-bold text-foreground mb-2">Первые шаги</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Начните с обзора системы, затем настройте подписки и запустите синхронизацию маркетплейсов.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onSelectSection('overview')}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Перейти к обзору →
            </button>
            <button
              onClick={() => onSelectSection('documentation')}
              className="px-4 py-2 rounded-lg border border-border bg-card text-foreground font-medium text-sm hover:border-primary/40 transition-colors"
            >
              Читать документацию →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
