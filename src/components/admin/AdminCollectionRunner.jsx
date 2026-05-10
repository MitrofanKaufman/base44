import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CollectionRunPipelineService } from '@/lib/CollectionRunPipelineService';
import { Play, Square, RotateCcw, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import AdminCollectionRunStats from './AdminCollectionRunStats';
import RunDetailsModal from './RunDetailsModal';

const STAGES = [
  'validate-input',
  'collect-marketplace-data',
  'normalize-events',
  'save-raw-frames',
  'save-events',
  'update-snapshots',
  'calculate-unit-economics',
  'verify-results',
  'build-report'
];

function StageIcon({ status }) {
  if (status === 'completed') return <CheckCircle className="w-4 h-4 text-success" />;
  if (status === 'running') return <Zap className="w-4 h-4 text-primary animate-pulse" />;
  if (status === 'failed') return <AlertTriangle className="w-4 h-4 text-destructive" />;
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

export default function AdminCollectionRunner() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    marketplace: 'wildberries',
    mode: 'product',
    productIds: '',
    sellerIds: '',
    includeFeedbacks: false,
    includeQuestions: false,
    includeSearch: false,
    includeUnitEconomics: true,
    dryRun: true,
    forceRefresh: false,
    concurrencyLimit: 5,
    timeoutMs: 30000
  });

  const [currentRunId, setCurrentRunId] = useState(null);
  const [_refreshInterval, _setRefreshInterval] = useState(null);
  const [selectedRunForDetails, setSelectedRunForDetails] = useState(null);
  const [selectedRunIds, setSelectedRunIds] = useState(new Set());

  const { data: currentRun } = useQuery({
    queryKey: ['ingestionRun', currentRunId],
    queryFn: () => currentRunId ? base44.entities.IngestionRun.read(currentRunId) : null,
    refetchInterval: currentRunId ? 1000 : false,
    enabled: !!currentRunId
  });

  const { data: recentRuns = [] } = useQuery({
    queryKey: ['recentRuns'],
    queryFn: () => base44.entities.IngestionRun.list('-updated_date', 10),
    refetchInterval: 3000
  });

  const { data: deadLetters = [] } = useQuery({
    queryKey: ['deadLetters', currentRunId],
    queryFn: () => currentRunId && currentRun 
      ? base44.entities.DeadLetter.filter({ runId: currentRun.runId })
      : [],
    refetchInterval: currentRunId ? 2000 : false
  });

  const startRunMutation = useMutation({
    mutationFn: async () => {
      const ids = formData.productIds
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      const sellerIds = formData.sellerIds
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const request = {
        marketplace: formData.marketplace,
        mode: formData.mode,
        productIds: formData.mode === 'product' || formData.mode === 'full' ? ids : undefined,
        sellerIds: formData.mode === 'seller' || formData.mode === 'full' ? sellerIds : undefined,
        includeFeedbacks: formData.includeFeedbacks,
        includeQuestions: formData.includeQuestions,
        includeSearch: formData.includeSearch,
        includeUnitEconomics: formData.includeUnitEconomics,
        dryRun: formData.dryRun,
        forceRefresh: formData.forceRefresh,
        concurrencyLimit: formData.concurrencyLimit,
        timeoutMs: formData.timeoutMs
      };

      const response = await CollectionRunPipelineService.start(request);
      return response;
    },
    onSuccess: async () => {
      const runs = await base44.entities.IngestionRun.list('-updated_date', 1);
      if (runs.length > 0) {
        setCurrentRunId(runs[0].id);
        queryClient.invalidateQueries({ queryKey: ['recentRuns'] });
      }
    }
  });

  const cancelRunMutation = useMutation({
    mutationFn: async () => {
      if (!currentRun?.runId) return;
      await CollectionRunPipelineService.cancel(currentRun.runId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingestionRun', currentRunId] });
    }
  });

  const retryErrorsMutation = useMutation({
    mutationFn: async () => {
      if (!currentRunId) return;
      await CollectionRunPipelineService.retryErrors(currentRunId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadLetters', currentRunId] });
    }
  });

  const retryAllFailedMutation = useMutation({
    mutationFn: async () => {
      const failedRuns = recentRuns.filter(r => r.status === 'failed');
      for (const run of failedRuns) {
        await CollectionRunPipelineService.start({
          ...run.request,
          forceRefresh: true
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentRuns'] });
      queryClient.invalidateQueries({ queryKey: ['ingestion-runs-all'] });
    }
  });

  const retrySelectedMutation = useMutation({
    mutationFn: async () => {
      const selectedRuns = recentRuns.filter(r => selectedRunIds.has(r.id) && r.status === 'failed');
      for (const run of selectedRuns) {
        await CollectionRunPipelineService.start({
          ...run.request,
          forceRefresh: true
        });
      }
    },
    onSuccess: () => {
      setSelectedRunIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['recentRuns'] });
      queryClient.invalidateQueries({ queryKey: ['ingestion-runs-all'] });
    }
  });

  const toggleRunSelection = (runId) => {
    const newSet = new Set(selectedRunIds);
    if (newSet.has(runId)) {
      newSet.delete(runId);
    } else {
      newSet.add(runId);
    }
    setSelectedRunIds(newSet);
  };

  const toggleAllSelection = () => {
    if (selectedRunIds.size === recentRuns.length) {
      setSelectedRunIds(new Set());
    } else {
      setSelectedRunIds(new Set(recentRuns.map(r => r.id)));
    }
  };

  return (
    <div className="space-y-4">
      {/* Новый прогон */}
      <Card className="p-4">
        <h3 className="font-bold text-base mb-4">Новый прогон</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium">Маркетплейс</label>
            <select
              value={formData.marketplace}
              onChange={e => setFormData({ ...formData, marketplace: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
            >
              <option value="wildberries">Wildberries</option>
              <option value="yandex">Yandex Market</option>
              <option value="ozon">Ozon</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Режим</label>
            <select
              value={formData.mode}
              onChange={e => setFormData({ ...formData, mode: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
            >
              <option value="product">Товары (product)</option>
              <option value="seller">Продавцы (seller)</option>
              <option value="full">Все данные (full)</option>
            </select>
          </div>

          {(formData.mode === 'product' || formData.mode === 'full') && (
            <div>
              <label className="text-sm font-medium">Article/nmId (через новую строку)</label>
              <Textarea
                value={formData.productIds}
                onChange={e => setFormData({ ...formData, productIds: e.target.value })}
                placeholder="123456&#10;789012&#10;345678"
                className="mt-1 text-sm h-20"
              />
            </div>
          )}

          {(formData.mode === 'seller' || formData.mode === 'full') && (
            <div>
              <label className="text-sm font-medium">Seller ID (через новую строку)</label>
              <Textarea
                value={formData.sellerIds}
                onChange={e => setFormData({ ...formData, sellerIds: e.target.value })}
                placeholder="seller1&#10;seller2"
                className="mt-1 text-sm h-20"
              />
            </div>
          )}
        </div>

        {/* Опции */}
        <div className="space-y-2 mb-4">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={formData.includeFeedbacks}
              onCheckedChange={v => setFormData({ ...formData, includeFeedbacks: v })}
            />
            <span className="text-sm">Включить отзывы</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={formData.includeQuestions}
              onCheckedChange={v => setFormData({ ...formData, includeQuestions: v })}
            />
            <span className="text-sm">Включить вопросы</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={formData.includeSearch}
              onCheckedChange={v => setFormData({ ...formData, includeSearch: v })}
            />
            <span className="text-sm">Включить поиск enrichment</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={formData.includeUnitEconomics}
              onCheckedChange={v => setFormData({ ...formData, includeUnitEconomics: v })}
            />
            <span className="text-sm">Расчет unit economics</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={formData.dryRun}
              onCheckedChange={v => setFormData({ ...formData, dryRun: v })}
            />
            <span className="text-sm">Dry run (используется mock данные)</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={formData.forceRefresh}
              onCheckedChange={v => setFormData({ ...formData, forceRefresh: v })}
            />
            <span className="text-sm">Принудительное обновление</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium">Concurrency limit</label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.concurrencyLimit}
              onChange={e => setFormData({ ...formData, concurrencyLimit: parseInt(e.target.value) })}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Timeout (ms)</label>
            <input
              type="number"
              min="1000"
              value={formData.timeoutMs}
              onChange={e => setFormData({ ...formData, timeoutMs: parseInt(e.target.value) })}
              className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => startRunMutation.mutate()}
            disabled={startRunMutation.isPending || currentRun?.status === 'running'}
            className="gap-2"
          >
            <Play className="w-4 h-4" />
            Запустить прогон
          </Button>
          {currentRun?.status === 'running' && (
            <Button
              onClick={() => cancelRunMutation.mutate()}
              disabled={cancelRunMutation.isPending}
              variant="destructive"
              className="gap-2"
            >
              <Square className="w-4 h-4" />
              Остановить процесс
            </Button>
          )}
          {deadLetters.length > 0 && (
            <Button
              onClick={() => retryErrorsMutation.mutate()}
              disabled={retryErrorsMutation.isPending}
              variant="outline"
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Повторить ошибки ({deadLetters.length})
            </Button>
          )}
        </div>
      </Card>

      {/* Текущий прогон */}
      {currentRun && (
        <Card className="p-4">
          <h3 className="font-bold text-base mb-4">Текущий прогон</h3>
          
          {/* Статус и прогресс */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Статус:</span>
              <span className={`font-bold text-sm ${
                currentRun.status === 'completed' ? 'text-success' :
                currentRun.status === 'failed' ? 'text-destructive' :
                currentRun.status === 'running' ? 'text-primary' :
                'text-muted-foreground'
              }`}>
                {currentRun.status?.toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Прогресс</span>
                <span>{currentRun.progress || 0}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${currentRun.progress || 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Этап:</span>
              <span className="font-mono text-xs">{currentRun.currentStage || '-'}</span>
            </div>
          </div>

          {/* Счетчики */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Events', value: currentRun.counters?.eventCount || 0 },
              { label: 'Raw Frames', value: currentRun.counters?.rawFrameCount || 0 },
              { label: 'Prod Snapshots', value: currentRun.counters?.productSnapshotCount || 0 },
              { label: 'Unit Economics', value: currentRun.counters?.unitEconomicsCount || 0 }
            ].map(({ label, value }) => (
              <div key={label} className="bg-secondary/50 rounded p-2 text-center">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-lg font-bold">{value}</div>
              </div>
            ))}
          </div>

          {/* Timeline этапов */}
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2">Этапы выполнения</h4>
            <div className="space-y-1">
              {(currentRun.timeline || STAGES.map(s => ({ stage: s, status: 'pending' }))).map((stage) => (
                <div key={stage.stage} className="flex items-center gap-2 text-xs">
                  <StageIcon status={stage.status} />
                  <span className="font-mono flex-1">{stage.stage}</span>
                  <span className="text-muted-foreground">{stage.durationMs ? `${stage.durationMs}ms` : '-'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Время */}
          {currentRun.startedAt && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Начало: {new Date(currentRun.startedAt).toLocaleString()}</div>
              {currentRun.finishedAt && <div>Окончание: {new Date(currentRun.finishedAt).toLocaleString()}</div>}
              {currentRun.durationMs && <div>Длительность: {(currentRun.durationMs / 1000).toFixed(1)}с</div>}
            </div>
          )}
        </Card>
      )}

      {/* Статистика по дням */}
      <AdminCollectionRunStats />

      {/* Таблица последних прогонов */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">Последние прогоны</h3>
          <div className="flex gap-2">
            {selectedRunIds.size > 0 && (
              <Button
                onClick={() => retrySelectedMutation.mutate()}
                disabled={retrySelectedMutation.isPending}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Перезапустить выбранные ({selectedRunIds.size})
              </Button>
            )}
            {recentRuns.some(r => r.status === 'failed') && (
              <Button
                onClick={() => retryAllFailedMutation.mutate()}
                disabled={retryAllFailedMutation.isPending}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Retry all failed ({recentRuns.filter(r => r.status === 'failed').length})
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-center py-2 px-2 w-10">
                  <Checkbox
                    checked={selectedRunIds.size === recentRuns.length && recentRuns.length > 0}
                    onCheckedChange={toggleAllSelection}
                  />
                </th>
                <th className="text-left py-2 px-2">Run ID</th>
                <th className="text-left py-2 px-2">Режим</th>
                <th className="text-left py-2 px-2">Статус</th>
                <th className="text-left py-2 px-2">Прогресс</th>
                <th className="text-left py-2 px-2">Начало</th>
                <th className="text-left py-2 px-2">События</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map(run => (
                <tr 
                  key={run.id} 
                  className="border-b border-border/50 hover:bg-secondary/50"
                >
                  <td className="py-2 px-2 text-center w-10">
                    <Checkbox
                      checked={selectedRunIds.has(run.id)}
                      onCheckedChange={() => toggleRunSelection(run.id)}
                    />
                  </td>
                  <td 
                    className="py-2 px-2 font-mono text-xs cursor-pointer"
                    onClick={() => setSelectedRunForDetails(run)}
                  >{run.runId?.substring(0, 8)}</td>
                  <td 
                    className="py-2 px-2 cursor-pointer hover:bg-secondary/70"
                    onClick={() => setSelectedRunForDetails(run)}
                  >{run.mode}</td>
                  <td 
                    className="py-2 px-2 cursor-pointer hover:bg-secondary/70"
                    onClick={() => setSelectedRunForDetails(run)}
                  >
                    <span className={`text-xs font-bold ${
                      run.status === 'completed' ? 'text-success' : 
                      run.status === 'failed' ? 'text-destructive' :
                      'text-muted-foreground'
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td 
                    className="py-2 px-2 cursor-pointer hover:bg-secondary/70"
                    onClick={() => setSelectedRunForDetails(run)}
                  >{run.progress}%</td>
                  <td 
                    className="py-2 px-2 text-xs cursor-pointer hover:bg-secondary/70"
                    onClick={() => setSelectedRunForDetails(run)}
                  >{new Date(run.startedAt).toLocaleTimeString()}</td>
                  <td 
                    className="py-2 px-2 text-xs cursor-pointer hover:bg-secondary/70"
                    onClick={() => setSelectedRunForDetails(run)}
                  >{run.counters?.eventCount || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Таблица ошибок */}
      {deadLetters.length > 0 && (
        <Card className="p-4">
          <h3 className="font-bold text-base mb-4">Ошибки ({deadLetters.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2">Этап</th>
                  <th className="text-left py-2 px-2">Event ID</th>
                  <th className="text-left py-2 px-2">Причина</th>
                  <th className="text-left py-2 px-2">Сообщение</th>
                  <th className="text-left py-2 px-2">Повтор</th>
                </tr>
              </thead>
              <tbody>
                {deadLetters.map(error => (
                  <tr key={error.id} className="border-b border-border/50">
                    <td className="py-2 px-2 font-mono">{error.stage?.substring(0, 12)}</td>
                    <td className="py-2 px-2 font-mono">{error.sourceEventId?.substring(0, 10)}</td>
                    <td className="py-2 px-2">{error.reason}</td>
                    <td className="py-2 px-2 text-muted-foreground">{error.message?.substring(0, 40)}</td>
                    <td className="py-2 px-2">{error.retryable ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Модальное окно деталей прогона */}
      <RunDetailsModal 
        run={selectedRunForDetails} 
        isOpen={!!selectedRunForDetails}
        onClose={() => setSelectedRunForDetails(null)}
      />
    </div>
  );
}
