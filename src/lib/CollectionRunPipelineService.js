// CollectionRunPipelineService - управляемый pipeline сбора и обработки маркетплейс-данных
import { base44 } from '@/api/base44Client';
import { v4 as uuidv4 } from 'uuid';

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

export class CollectionRunPipelineService {
  static async start(request) {
    const runId = uuidv4();
    const startedAt = new Date().toISOString();

    // Создаем запись прогона
    const run = await base44.entities.IngestionRun.create({
      runId,
      source: request.marketplace || 'wildberries',
      sourceMode: request.dryRun ? 'mock' : 'real',
      mode: request.mode || 'product',
      status: 'queued',
      progress: 0,
      request,
      counters: {
        eventsProcessed: 0,
        eventsError: 0,
        rawFrameCount: 0,
        eventCount: 0,
        productSnapshotCount: 0,
        sellerSnapshotCount: 0,
        unitEconomicsCount: 0,
        deadLetterCount: 0
      },
      timeline: STAGES.map(stage => ({
        stage,
        status: 'pending',
        startedAt: null,
        finishedAt: null,
        durationMs: 0,
        error: null
      })),
      errors: [],
      startedAt,
      currentStage: 'validate-input'
    });

    // Запускаем pipeline асинхронно
    this._runPipeline(run.id, request).catch(err => {
      console.error('Pipeline error:', err);
    });

    return {
      runId: run.id,
      status: 'queued',
      progress: 0,
      message: 'Прогон инициирован'
    };
  }

  static async _runPipeline(dbRunId, request) {
    try {
      const runRecord = (await base44.entities.IngestionRun.filter({ id: dbRunId }))[0];
      const context = {
        dbRunId,
        runId: runRecord.runId,
        request,
        data: {
          rawFrames: [],
          events: [],
          productSnapshots: [],
          sellerSnapshots: [],
          unitEconomicsSnapshots: [],
          errors: []
        }
      };

      // 1. Validate input
      await this._executeStage(context, 'validate-input', () => 
        this.validateInput(context)
      );

      // 2. Collect data
      await this._executeStage(context, 'collect-marketplace-data', () =>
        this.collectMarketplaceData(context)
      );

      // 3. Normalize events
      await this._executeStage(context, 'normalize-events', () =>
        this.normalizeEvents(context)
      );

      // 4. Save raw frames
      await this._executeStage(context, 'save-raw-frames', () =>
        this.saveRawFrames(context)
      );

      // 5. Save events
      await this._executeStage(context, 'save-events', () =>
        this.saveEvents(context)
      );

      // 6. Update snapshots
      await this._executeStage(context, 'update-snapshots', () =>
        this.updateSnapshots(context)
      );

      // 7. Calculate unit economics
      if (request.includeUnitEconomics) {
        await this._executeStage(context, 'calculate-unit-economics', () =>
          this.calculateUnitEconomics(context)
        );
      }

      // 8. Verify results
      await this._executeStage(context, 'verify-results', () =>
        this.verifyResults(context)
      );

      // 9. Build report
      await this._executeStage(context, 'build-report', () =>
        this.buildReport(context)
      );

      // Обновляем статус на completed
      await base44.entities.IngestionRun.update(context.dbRunId, {
        status: 'completed',
        progress: 100,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - new Date(context.startedAt).getTime()
      });

    } catch (error) {
      console.error('Pipeline failed:', error);
      await base44.entities.IngestionRun.update(dbRunId, {
        status: 'failed',
        finishedAt: new Date().toISOString()
      });
    }
  }

  static async _executeStage(context, stageName, fn) {
    const run = (await base44.entities.IngestionRun.filter({ id: context.dbRunId }))[0];
    const timeline = run.timeline || [];
    const stageIdx = timeline.findIndex(t => t.stage === stageName);
    
    const stageStarted = new Date().toISOString();

    // Обновляем текущий этап
    await base44.entities.IngestionRun.update(context.dbRunId, {
      currentStage: stageName,
      timeline: timeline.map((t, i) => 
        i === stageIdx ? { ...t, status: 'running', startedAt: stageStarted } : t
      )
    });

    try {
      await fn();
      const stageFinished = new Date().toISOString();
      const durationMs = new Date(stageFinished) - new Date(stageStarted);

      // Обновляем завершенный этап
      await base44.entities.IngestionRun.update(context.dbRunId, {
        timeline: timeline.map((t, i) =>
          i === stageIdx 
            ? { ...t, status: 'completed', finishedAt: stageFinished, durationMs }
            : t
        ),
        progress: Math.round((stageIdx + 1) / STAGES.length * 100)
      });
    } catch (error) {
      const stageFinished = new Date().toISOString();
      const durationMs = new Date(stageFinished) - new Date(stageStarted);

      await base44.entities.IngestionRun.update(context.dbRunId, {
        timeline: timeline.map((t, i) =>
          i === stageIdx
            ? { ...t, status: 'failed', finishedAt: stageFinished, durationMs, error: error.message }
            : t
        ),
        status: 'failed'
      });

      throw error;
    }
  }

  static async validateInput(context) {
    const { mode, marketplace } = context.request;
    if (!['product', 'seller', 'full'].includes(mode)) {
      throw new Error('Invalid mode');
    }
    if (!['wildberries', 'yandex', 'ozon'].includes(marketplace)) {
      throw new Error('Invalid marketplace');
    }
  }

  static async collectMarketplaceData(context) {
    const { mode, marketplace, productIds, sellerIds, dryRun } = context.request;

    if (dryRun) {
      // Mock data для демонстрации
      context.data.rawFrames = this._generateMockRawFrames(mode, productIds, sellerIds);
    } else {
      // Реальный сбор - будет подключена настоящая API
      context.data.rawFrames = await this._collectFromWildberries(mode, productIds, sellerIds);
    }
  }

  static _generateMockRawFrames(mode, productIds = [], sellerIds = []) {
    const frames = [];

    if (mode === 'product' || mode === 'full') {
      const ids = productIds.length > 0 ? productIds : ['1234567'];
      ids.forEach(id => {
        frames.push({
          source: 'wildberries',
          stream: 'product',
          sourceEventId: id,
          payload: {
            id: id,
            name: `Товар ${id}`,
            price: Math.floor(Math.random() * 10000) + 100,
            rating: Math.random() * 5,
            feedbackCount: Math.floor(Math.random() * 1000)
          },
          payloadHash: this._hashPayload({ id }),
          emittedAt: new Date().toISOString(),
          receivedAt: new Date().toISOString(),
          traceId: `mock-${id}`,
          processingStatus: 'received'
        });
      });
    }

    if (mode === 'seller' || mode === 'full') {
      const ids = sellerIds.length > 0 ? sellerIds : ['seller-1'];
      ids.forEach(id => {
        frames.push({
          source: 'wildberries',
          stream: 'seller',
          sourceEventId: id,
          payload: {
            id: id,
            name: `Магазин ${id}`,
            rating: Math.random() * 5,
            reviewsCount: Math.floor(Math.random() * 5000)
          },
          payloadHash: this._hashPayload({ id }),
          emittedAt: new Date().toISOString(),
          receivedAt: new Date().toISOString(),
          traceId: `mock-${id}`,
          processingStatus: 'received'
        });
      });
    }

    return frames;
  }

  static async _collectFromWildberries(mode, productIds, sellerIds) {
    // TODO: интегрировать реальный API Wildberries
    console.warn('Real Wildberries collection not implemented yet, using mock');
    return this._generateMockRawFrames(mode, productIds, sellerIds);
  }

  static async normalizeEvents(context) {
    context.data.events = context.data.rawFrames.map(frame => {
      const type = frame.stream === 'product' ? 'product.update' : 'seller.update';
      return {
        schemaVersion: '1.0',
        type,
        source: frame.source,
        sourceEventId: frame.sourceEventId,
        traceId: frame.traceId,
        data: frame.payload,
        createdAt: new Date().toISOString()
      };
    });
  }

  static async saveRawFrames(context) {
    const frames = context.data.rawFrames;
    for (const frame of frames) {
      try {
        await base44.entities.RawMarketplaceFrame.create({
          ...frame,
          schemaVersion: '1.0',
          processingStatus: 'processed'
        });
      } catch (error) {
        await this._recordDeadLetter(context, 'save-raw-frames', frame, error);
      }
    }
  }

  static async saveEvents(context) {
    const events = context.data.events;
    for (const event of events) {
      try {
        await base44.entities.MarketplaceEvent.create(event);
      } catch (error) {
        await this._recordDeadLetter(context, 'save-events', event, error);
      }
    }
  }

  static async updateSnapshots(context) {
    for (const event of context.data.events) {
      try {
        if (event.type === 'product.update') {
          const snapshot = await base44.entities.ProductSnapshot.create({
            productId: event.sourceEventId,
            source: event.source,
            externalId: event.sourceEventId,
            name: event.data.name || `Product ${event.sourceEventId}`,
            sku: event.data.sku || event.sourceEventId,
            price: event.data.price || 0,
            data: event.data,
            updatedAt: new Date().toISOString()
          });
          context.data.productSnapshots.push(snapshot);
        } else if (event.type === 'seller.update') {
          const snapshot = await base44.entities.SellerSnapshot.create({
            sellerId: event.sourceEventId,
            source: event.source,
            name: event.data.name || `Seller ${event.sourceEventId}`,
            rating: event.data.rating || 0,
            data: event.data,
            updatedAt: new Date().toISOString()
          });
          context.data.sellerSnapshots.push(snapshot);
        }
      } catch (error) {
        await this._recordDeadLetter(context, 'update-snapshots', event, error);
      }
    }
  }

  static async calculateUnitEconomics(context) {
    // Заглушка: в реальной реализации здесь вычисляются метрики
    for (const snapshot of context.data.productSnapshots) {
      try {
        const economics = {
          itemId: snapshot.productId,
          source: snapshot.source,
          price: snapshot.price || 0,
          cost: 0,
          margin: (snapshot.price || 0) * 0.3,
          marginPct: 30,
          metrics: {
            grossMargin: 30,
            contribution: (snapshot.price || 0) * 0.3,
            profitability: true
          },
          updatedAt: new Date().toISOString()
        };
        const saved = await base44.entities.UnitEconomicsSnapshot.create(economics);
        context.data.unitEconomicsSnapshots.push(saved);
      } catch (error) {
        await this._recordDeadLetter(context, 'calculate-unit-economics', snapshot, error);
      }
    }
  }

  static async verifyResults(context) {
    const run = (await base44.entities.IngestionRun.filter({ id: context.dbRunId }))[0];
    run.counters = {
      rawFrameCount: context.data.rawFrames.length,
      eventCount: context.data.events.length,
      productSnapshotCount: context.data.productSnapshots.length,
      sellerSnapshotCount: context.data.sellerSnapshots.length,
      unitEconomicsCount: context.data.unitEconomicsSnapshots.length,
      deadLetterCount: context.data.errors.length,
      eventsProcessed: context.data.events.length,
      eventsError: context.data.errors.length
    };
    await base44.entities.IngestionRun.update(context.dbRunId, run);
  }

  static async buildReport(context) {
    const run = (await base44.entities.IngestionRun.filter({ id: context.dbRunId }))[0];
    const report = {
      runId: run.runId,
      status: run.status,
      mode: run.mode,
      source: run.source,
      sourceMode: run.sourceMode,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationMs: run.durationMs,
      counters: run.counters,
      stages: run.timeline,
      createdSnapshots: {
        products: context.data.productSnapshots.length,
        sellers: context.data.sellerSnapshots.length,
        unitEconomics: context.data.unitEconomicsSnapshots.length
      },
      errors: context.data.errors
    };
    await base44.entities.IngestionRun.update(context.dbRunId, {
      report
    });
  }

  static async cancel(runId) {
    const run = await base44.entities.IngestionRun.filter({ runId }, '-created_date', 1);
    if (run.length === 0) throw new Error('Run not found');
    await base44.entities.IngestionRun.update(run[0].id, {
      status: 'cancelled',
      finishedAt: new Date().toISOString()
    });
  }

  static async retryErrors(dbRunId) {
    const runRecord = (await base44.entities.IngestionRun.filter({ id: dbRunId }))[0];
    const errors = await base44.entities.DeadLetter.filter({ runId: runRecord.runId, retryable: true });
    
    for (const error of errors) {
      try {
        // Переобработка payload
        if (error.stage === 'save-raw-frames') {
          await base44.entities.RawMarketplaceFrame.create(error.payload);
        } else if (error.stage === 'save-events') {
          await base44.entities.MarketplaceEvent.create(error.payload);
        }
        
        // Помечаем как разрешенную
        await base44.entities.DeadLetter.update(error.id, {
          resolved: true,
          resolvedAt: new Date().toISOString()
        });
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }
  }

  static async _recordDeadLetter(context, stage, payload, error) {
    const run = (await base44.entities.IngestionRun.filter({ id: context.dbRunId }))[0];
    await base44.entities.DeadLetter.create({
      runId: run.runId,
      stage,
      reason: 'processing_error',
      message: error.message,
      sourceEventId: payload.sourceEventId || payload.id || 'unknown',
      payloadHash: this._hashPayload(payload),
      traceId: payload.traceId || `trace-${Date.now()}`,
      retryable: true,
      payload,
      stackTrace: error.stack,
      resolved: false
    });
    context.data.errors.push(error);
  }

  static _hashPayload(payload) {
    // Простой хеш для демонстрации (браузер-совместимо)
    const str = JSON.stringify(payload);
    return btoa(str).substring(0, 32);
  }
}