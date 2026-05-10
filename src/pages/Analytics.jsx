import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useState } from 'react';
import AnalyticsMetrics from '@/components/analytics/AnalyticsMetrics';
import EventsProcessedChart from '@/components/analytics/EventsProcessedChart';
import ErrorRateChart from '@/components/analytics/ErrorRateChart';
import ExecutionTimeChart from '@/components/analytics/ExecutionTimeChart';
import RunsTableHeader from '@/components/analytics/RunsTableHeader';
import RunsTableRow from '@/components/analytics/RunsTableRow';
import RunsTableFilters from '@/components/analytics/RunsTableFilters';
import SuccessRateModal from '@/components/analytics/SuccessRateModal';
import StatusDistributionModal from '@/components/analytics/StatusDistributionModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp } from 'lucide-react';

const PERIODS = [
  { label: '7 дней', days: 7 },
  { label: '14 дней', days: 14 },
  { label: '30 дней', days: 30 },
];

const ITEMS_PER_PAGE = 15;

const processAnalyticsData = (runs) => {
  // Группируем по датам
  const dailyStats = {};

  runs.forEach(run => {
    const date = new Date(run.startedAt).toLocaleDateString('ru-RU');
    if (!dailyStats[date]) {
      dailyStats[date] = {
        date,
        totalEvents: 0,
        totalErrors: 0,
        totalDuration: 0,
        maxDuration: 0,
        runCount: 0,
        successCount: 0,
      };
    }

    const counters = run.counters || {};
    const events = counters.eventCount || 0;
    const errors = counters.deadLetterCount || 0;
    const duration = run.durationMs || 0;

    dailyStats[date].totalEvents += events;
    dailyStats[date].totalErrors += errors;
    dailyStats[date].totalDuration += duration;
    dailyStats[date].maxDuration = Math.max(dailyStats[date].maxDuration, duration);
    dailyStats[date].runCount += 1;
    if (run.status === 'completed') dailyStats[date].successCount += 1;
  });

  // Преобразуем в массив для графиков
  const data = Object.values(dailyStats).sort((a, b) => new Date(a.date) - new Date(b.date));

  return data.map(day => ({
    date: day.date,
    count: day.totalEvents,
    errorRate: day.totalEvents > 0 ? (day.totalErrors / day.totalEvents) * 100 : 0,
    avgDuration: day.runCount > 0 ? day.totalDuration / day.runCount : 0,
    maxDuration: day.maxDuration,
  }));
};

const calculateMetrics = (runs) => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayRuns = runs.filter(r => new Date(r.startedAt).toDateString() === now.toDateString());
  const yesterdayRuns = runs.filter(r => {
    const runDate = new Date(r.startedAt);
    return runDate.toDateString() === yesterday.toDateString();
  });

  const calculateStats = (runSet) => {
    const totalEvents = runSet.reduce((sum, r) => sum + (r.counters?.eventCount || 0), 0);
    const totalErrors = runSet.reduce((sum, r) => sum + (r.counters?.deadLetterCount || 0), 0);
    const avgExecutionTime = runSet.length > 0
      ? runSet.reduce((sum, r) => sum + (r.durationMs || 0), 0) / runSet.length / 1000
      : 0;

    return { totalEvents, totalErrors, avgErrorRate: totalEvents > 0 ? (totalErrors / totalEvents) * 100 : 0, avgExecutionTime };
  };

  const today = calculateStats(todayRuns);
  const yesterday_stats = calculateStats(yesterdayRuns);

  return {
    totalEvents: today.totalEvents,
    totalErrors: today.totalErrors,
    avgErrorRate: today.avgErrorRate,
    avgExecutionTime: today.avgExecutionTime,
    eventsTrend: yesterday_stats.totalEvents > 0 ? ((today.totalEvents - yesterday_stats.totalEvents) / yesterday_stats.totalEvents) * 100 : 0,
    errorsTrend: yesterday_stats.totalErrors > 0 ? ((today.totalErrors - yesterday_stats.totalErrors) / yesterday_stats.totalErrors) * 100 : 0,
    errorRateTrend: yesterday_stats.avgErrorRate > 0 ? ((today.avgErrorRate - yesterday_stats.avgErrorRate) / yesterday_stats.avgErrorRate) * 100 : 0,
    executionTimeTrend: yesterday_stats.avgExecutionTime > 0 ? ((today.avgExecutionTime - yesterday_stats.avgExecutionTime) / yesterday_stats.avgExecutionTime) * 100 : 0,
  };
};

export default function Analytics() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(7);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ status: 'all', source: 'all', mode: 'all' });
  const [showSuccessRateModal, setShowSuccessRateModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const { data: allRuns = [] } = useQuery({
    queryKey: ['ingestion-runs-all'],
    queryFn: async () => {
      const runs = await base44.entities.IngestionRun.list('-startedAt', 500);
      return runs || [];
    },
  });

  const deleteRunMutation = useMutation({
    mutationFn: (runId) => base44.entities.IngestionRun.delete(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingestion-runs-all'] });
    },
  });

  // Фильтруем по периоду
  const periodFilteredRuns = allRuns.filter(run => {
    const runDate = new Date(run.startedAt);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period);
    return runDate >= cutoffDate;
  });

  // Применяем фильтры
  const filteredRuns = periodFilteredRuns.filter(run => {
    const statusMatch = filters.status === 'all' || run.status === filters.status;
    const sourceMatch = filters.source === 'all' || run.source === filters.source;
    const modeMatch = filters.mode === 'all' || run.mode === filters.mode;
    return statusMatch && sourceMatch && modeMatch;
  });

  // Сортируем
  const sortedRuns = [...filteredRuns].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'date':
        aVal = new Date(a.startedAt).getTime();
        bVal = new Date(b.startedAt).getTime();
        break;
      case 'source':
        aVal = a.source || '';
        bVal = b.source || '';
        break;
      case 'mode':
        aVal = a.mode || '';
        bVal = b.mode || '';
        break;
      case 'status':
        aVal = a.status || '';
        bVal = b.status || '';
        break;
      case 'events':
        aVal = a.counters?.eventCount || 0;
        bVal = b.counters?.eventCount || 0;
        break;
      case 'errors':
        aVal = a.counters?.deadLetterCount || 0;
        bVal = b.counters?.deadLetterCount || 0;
        break;
      case 'duration':
        aVal = a.durationMs || 0;
        bVal = b.durationMs || 0;
        break;
      default:
        return 0;
    }

    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Пагинация
  const totalPages = Math.ceil(sortedRuns.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRuns = sortedRuns.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setFilters({ status: 'all', source: 'all', mode: 'all' });
    setCurrentPage(1);
  };

  const handleDelete = (run) => {
    if (confirm(`Вы уверены, что хотите удалить прогон ${run.runId}?`)) {
      deleteRunMutation.mutate(run.id);
    }
  };

  const chartData = processAnalyticsData(periodFilteredRuns);
  const metrics = calculateMetrics(allRuns);

  return (
    <div className="p-4 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Аналитика</h1>
        <p className="text-sm text-muted-foreground mt-1">Мониторинг показателей обработки прогонов</p>
      </div>

      {/* Метрики */}
      <AnalyticsMetrics metrics={metrics} />

      {/* Фильтр по периодам */}
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <Button
            key={p.days}
            variant={period === p.days ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p.days)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Модальные окна */}
      <SuccessRateModal isOpen={showSuccessRateModal} onClose={() => setShowSuccessRateModal(false)} data={periodFilteredRuns} />
      <StatusDistributionModal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} data={periodFilteredRuns} />

      {/* Графики */}
      <div className="grid grid-cols-1 gap-6">
        <EventsProcessedChart data={chartData} />
        <ErrorRateChart data={chartData} />
        <ExecutionTimeChart data={chartData} />
      </div>

      {/* Блок успешности */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Показатели успешности</CardTitle>
              <CardDescription>Процент успешности и статус распределение прогонов</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowSuccessRateModal(true)} className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Процент успешности
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowStatusModal(true)} className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Статус прогонов
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Таблица прогонов */}
      {sortedRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>История прогонов</CardTitle>
            <CardDescription>Всего прогонов: {sortedRuns.length}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RunsTableFilters filters={filters} onFilterChange={setFilters} onClearFilters={handleClearFilters} />

            <div className="overflow-x-auto">
              <table className="w-full">
                <RunsTableHeader
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
                <tbody>
                  {paginatedRuns.map(run => (
                    <RunsTableRow
                      key={run.id}
                      run={run}
                      onDelete={() => handleDelete(run)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-xs text-muted-foreground">
                  Показано {startIdx + 1}-{Math.min(startIdx + ITEMS_PER_PAGE, sortedRuns.length)} из {sortedRuns.length}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    ← Назад
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        size="sm"
                        variant={currentPage === page ? 'default' : 'outline'}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    Вперёд →
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}