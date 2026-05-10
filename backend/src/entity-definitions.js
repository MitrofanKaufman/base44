const t = {
  string: (description, extra = {}) => ({ type: 'string', description, ...extra }),
  number: (description, extra = {}) => ({ type: 'number', description, ...extra }),
  boolean: (description, extra = {}) => ({ type: 'boolean', description, ...extra }),
  object: (description) => ({ type: 'object', description, additionalProperties: true }),
  array: (description, items = { type: 'object', additionalProperties: true }) => ({ type: 'array', description, items })
};

export const entityDefinitions = {
  Client: {
    table: 'clients',
    idField: 'id',
    required: ['name'],
    search: ['name', 'email', 'phone', 'status', 'notes'],
    fields: {
      name: { db: 'name', schema: t.string('Название клиента / компании') },
      email: { db: 'email', schema: t.string('Email клиента') },
      phone: { db: 'phone', schema: t.string('Телефон') },
      wb_api_token: { db: 'wb_api_token', schema: t.string('API токен Wildberries (статистика)') },
      wb_api_token_ads: { db: 'wb_api_token_ads', schema: t.string('API токен WB (реклама)') },
      status: { db: 'status', schema: t.string('', { enum: ['active', 'inactive', 'trial'] }) },
      notes: { db: 'notes', schema: t.string('Заметки') },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  Project: {
    table: 'projects',
    idField: 'id',
    required: ['client_id', 'name'],
    search: ['name', 'description', 'status', 'wb_supplier_id', 'client_id'],
    fields: {
      client_id: { db: 'client_id', schema: t.string('ID клиента') },
      name: { db: 'name', schema: t.string('Название проекта / кампании') },
      description: { db: 'description', schema: t.string('Описание') },
      status: { db: 'status', schema: t.string('', { enum: ['active', 'paused', 'completed', 'archived'] }) },
      wb_supplier_id: { db: 'wb_supplier_id', schema: t.string('ID продавца на WB') },
      fixed_monthly: { db: 'fixed_monthly', schema: t.number('Постоянные расходы в месяц (руб)') },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  Product: {
    table: 'products',
    idField: 'id',
    required: ['project_id', 'wb_sku', 'name'],
    search: ['wb_sku', 'name', 'category', 'status', 'project_id', 'client_id'],
    fields: {
      project_id: { db: 'project_id', schema: t.string('ID проекта') },
      client_id: { db: 'client_id', schema: t.string('ID клиента') },
      wb_sku: { db: 'wb_sku', schema: t.string('Артикул WB / vendorCode') },
      name: { db: 'name', schema: t.string('Название товара') },
      image_url: { db: 'image_url', schema: t.string('Фото товара') },
      category: { db: 'category', schema: t.string('Категория WB') },
      price: { db: 'price', schema: t.number('Цена продажи (руб)') },
      sale_price: { db: 'sale_price', schema: t.number('Цена со скидкой (руб)') },
      discount_pct: { db: 'discount_pct', schema: t.number('Скидка (%)') },
      wb_commission_pct: { db: 'wb_commission_pct', schema: t.number('Комиссия WB (%)') },
      size_length_cm: { db: 'size_length_cm', schema: t.number('Длина (см)') },
      size_width_cm: { db: 'size_width_cm', schema: t.number('Ширина (см)') },
      size_height_cm: { db: 'size_height_cm', schema: t.number('Высота (см)') },
      weight_kg: { db: 'weight_kg', schema: t.number('Вес (кг)') },
      fulfillment_mode: { db: 'fulfillment_mode', schema: t.string('', { enum: ['FBO', 'FBS'] }) },
      status: { db: 'status', schema: t.string('', { enum: ['active', 'archived'] }) },
      last_synced_at: { db: 'last_synced_at', schema: t.string('Дата последней синхронизации', { format: 'date-time' }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  Calculation: {
    table: 'calculations',
    idField: 'id',
    required: ['product_id', 'project_id'],
    search: ['name', 'fulfillment_mode', 'tax_system', 'product_id', 'project_id', 'client_id'],
    fields: {
      product_id: { db: 'product_id', schema: t.string('ID товара') },
      project_id: { db: 'project_id', schema: t.string('ID проекта') },
      client_id: { db: 'client_id', schema: t.string('ID клиента') },
      name: { db: 'name', schema: t.string('Название расчёта / версии') },
      fulfillment_mode: { db: 'fulfillment_mode', schema: t.string('', { enum: ['FBO', 'FBS'] }) },
      tax_system: { db: 'tax_system', schema: t.string('Система налогообложения', { enum: ['usn_income', 'usn_income_expense'] }) },
      tax_pct: { db: 'tax_pct', schema: t.number('Налог (%)') },
      acquiring_pct: { db: 'acquiring_pct', schema: t.number('Эквайринг (%)') },
      promo_pct: { db: 'promo_pct', schema: t.number('Промо (%)') },
      return_rate_pct: { db: 'return_rate_pct', schema: t.number('Возвраты (%)') },
      cogs_purchase: { db: 'cogs_purchase', schema: t.number('Закупочная себестоимость (руб)') },
      cogs_packaging: { db: 'cogs_packaging', schema: t.number('Упаковка (руб)') },
      cogs_fulfillment: { db: 'cogs_fulfillment', schema: t.number('Сборка (руб)') },
      cogs_inbound_to_wb: { db: 'cogs_inbound_to_wb', schema: t.number('Доставка до WB (руб)') },
      waste_pct: { db: 'waste_pct', schema: t.number('Брак/списания (%)') },
      cac: { db: 'cac', schema: t.number('CAC — стоимость привлечения (руб)') },
      paid_share_pct: { db: 'paid_share_pct', schema: t.number('Доля платного трафика (%)') },
      fixed_monthly: { db: 'fixed_monthly', schema: t.number('Постоянные расходы/мес (руб)') },
      fbo_wb_logistics: { db: 'fbo_wb_logistics', schema: t.number('Логистика WB FBO (руб)') },
      fbo_storage: { db: 'fbo_storage', schema: t.number('Хранение FBO (руб)') },
      fbo_other: { db: 'fbo_other', schema: t.number('Прочее FBO (руб)') },
      fbs_last_mile: { db: 'fbs_last_mile', schema: t.number('Последняя миля FBS (руб)') },
      fbs_ops: { db: 'fbs_ops', schema: t.number('Операционные FBS (руб)') },
      fbs_storage: { db: 'fbs_storage', schema: t.number('Хранение FBS (руб)') },
      fbs_other: { db: 'fbs_other', schema: t.number('Прочее FBS (руб)') },
      return_loss: { db: 'return_loss', schema: t.number('Стоимость возврата (руб)') },
      price_net: { db: 'price_net', schema: t.number('Цена для расчёта') },
      revenue_net: { db: 'revenue_net', schema: t.number('Чистая выручка') },
      cogs_base: { db: 'cogs_base', schema: t.number('Базовая себестоимость') },
      cogs_with_waste: { db: 'cogs_with_waste', schema: t.number('Себестоимость с браком') },
      var_cost: { db: 'var_cost', schema: t.number('Переменные затраты') },
      gross_profit: { db: 'gross_profit', schema: t.number('Валовая прибыль') },
      gross_margin_pct: { db: 'gross_margin_pct', schema: t.number('Валовая маржа (%)') },
      marketing_cost: { db: 'marketing_cost', schema: t.number('Маркетинг на единицу') },
      contribution: { db: 'contribution', schema: t.number('Contribution margin') },
      contribution_pct: { db: 'contribution_pct', schema: t.number('Contribution margin (%)') },
      bep_units: { db: 'bep_units', schema: t.number('Точка безубыточности (шт/мес)') },
      is_profitable: { db: 'is_profitable', schema: t.boolean('Прибыльная модель') },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  RawMarketplaceFrame: {
    table: 'raw_marketplace_frames',
    idField: 'id',
    required: ['source', 'stream', 'sourceEventId', 'payload'],
    search: ['source', 'stream', 'sourceEventId', 'traceId', 'processingStatus'],
    fields: {
      schemaVersion: { db: 'schemaversion', schema: t.string('Версия схемы входящих данных') },
      source: { db: 'source', schema: t.string('Источник маркетплейса', { enum: ['wildberries', 'yandex', 'ozon'] }) },
      stream: { db: 'stream', schema: t.string('Поток данных (product, seller, order и т.д.)') },
      sourceEventId: { db: 'sourceeventid', schema: t.string('ID события в системе источника') },
      payloadHash: { db: 'payloadhash', schema: t.string('SHA-256 хеш payload для дедупликации') },
      emittedAt: { db: 'emittedat', schema: t.string('Когда событие было выгенерировано в источнике', { format: 'date-time' }) },
      receivedAt: { db: 'receivedat', schema: t.string('Когда мы получили событие', { format: 'date-time' }) },
      traceId: { db: 'traceid', schema: t.string('ID трассировки для логирования') },
      payload: { db: 'payload', schema: t.object('Сырой JSON payload от маркетплейса') },
      processingStatus: { db: 'processingstatus', schema: t.string('', { enum: ['received', 'processing', 'processed', 'failed'] }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  MarketplaceEvent: {
    table: 'marketplace_events',
    idField: 'id',
    required: ['type', 'source', 'data'],
    search: ['type', 'source', 'sourceEventId', 'traceId'],
    fields: {
      schemaVersion: { db: 'schemaversion', schema: t.string('Версия схемы события') },
      type: { db: 'type', schema: t.string('Тип нормализованного события', { enum: ['product.update', 'product.delete', 'seller.update', 'seller.delete', 'order.created', 'order.updated'] }) },
      source: { db: 'source', schema: t.string('Источник события', { enum: ['wildberries', 'yandex', 'ozon'] }) },
      sourceEventId: { db: 'sourceeventid', schema: t.string('ID события в системе источника') },
      traceId: { db: 'traceid', schema: t.string('ID трассировки для correlation') },
      data: { db: 'data', schema: t.object('Нормализованные данные события') },
      createdAt: { db: 'createdat', schema: t.string('Когда событие было создано в нашей системе', { format: 'date-time' }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  ProductSnapshot: {
    table: 'product_snapshots',
    idField: 'id',
    required: ['productId', 'source', 'data'],
    search: ['productId', 'source', 'externalId', 'name', 'sku'],
    fields: {
      productId: { db: 'productid', schema: t.string('ID товара в нашей системе / маркетплейсе') },
      source: { db: 'source', schema: t.string('Источник товара', { enum: ['wildberries', 'yandex', 'ozon'] }) },
      externalId: { db: 'externalid', schema: t.string('ID товара в системе маркетплейса') },
      name: { db: 'name', schema: t.string('Название товара') },
      sku: { db: 'sku', schema: t.string('SKU / артикул') },
      price: { db: 'price', schema: t.number('Текущая цена') },
      data: { db: 'data', schema: t.object('Снимок всех данных товара') },
      updatedAt: { db: 'updatedat', schema: t.string('Когда был последний обновлен снимок', { format: 'date-time' }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  SellerSnapshot: {
    table: 'seller_snapshots',
    idField: 'id',
    required: ['sellerId', 'source', 'data'],
    search: ['sellerId', 'source', 'name'],
    fields: {
      sellerId: { db: 'sellerid', schema: t.string('ID продавца в маркетплейсе') },
      source: { db: 'source', schema: t.string('Источник данных продавца', { enum: ['wildberries', 'yandex', 'ozon'] }) },
      name: { db: 'name', schema: t.string('Название магазина') },
      rating: { db: 'rating', schema: t.number('Рейтинг продавца') },
      data: { db: 'data', schema: t.object('Снимок всех данных продавца') },
      updatedAt: { db: 'updatedat', schema: t.string('Когда был последний обновлен снимок', { format: 'date-time' }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  UnitEconomicsSnapshot: {
    table: 'unit_economics_snapshots',
    idField: 'id',
    required: ['itemId', 'source', 'metrics'],
    search: ['itemId', 'source'],
    fields: {
      itemId: { db: 'itemid', schema: t.string('ID товара / SKU') },
      source: { db: 'source', schema: t.string('Источник', { enum: ['wildberries', 'yandex', 'ozon'] }) },
      price: { db: 'price', schema: t.number('Цена продажи') },
      cost: { db: 'cost', schema: t.number('Себестоимость') },
      margin: { db: 'margin', schema: t.number('Маржа в рублях') },
      marginPct: { db: 'marginpct', schema: t.number('Маржа в процентах') },
      metrics: { db: 'metrics', schema: t.object('Расширенные метрики unit economics') },
      updatedAt: { db: 'updatedat', schema: t.string('Когда были пересчитаны метрики', { format: 'date-time' }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  IngestionRun: {
    table: 'ingestion_runs',
    idField: 'id',
    required: ['source', 'status'],
    search: ['runId', 'source', 'mode', 'status', 'currentStage'],
    fields: {
      runId: { db: 'runid', schema: t.string('Уникальный идентификатор прогона') },
      source: { db: 'source', schema: t.string('Источник данных', { enum: ['wildberries', 'yandex', 'ozon'] }) },
      sourceMode: { db: 'sourcemode', schema: t.string('Способ сбора: реальные данные, mock или fallback', { enum: ['real', 'mock', 'fallback'] }) },
      mode: { db: 'mode', schema: t.string('Режим прогона', { enum: ['product', 'seller', 'full'] }) },
      stream: { db: 'stream', schema: t.string('Поток обработки (product, seller и т.д.)') },
      status: { db: 'status', schema: t.string('Статус прогона', { enum: ['queued', 'running', 'completed', 'failed', 'cancelled', 'partial'] }) },
      progress: { db: 'progress', schema: t.number('Прогресс в процентах (0-100)') },
      currentStage: { db: 'currentstage', schema: t.string('Текущий этап pipeline') },
      request: { db: 'request', schema: t.object('Оригинальный RunCollectionRequest') },
      counters: { db: 'counters', schema: t.object('Счетчики сущностей') },
      timeline: { db: 'timeline', schema: t.array('Этапы выполнения') },
      errors: { db: 'errors', schema: t.array('Список ошибок прогона') },
      report: { db: 'report', schema: t.object('Финальный отчет прогона') },
      startedAt: { db: 'startedat', schema: t.string('Время начала прогона', { format: 'date-time' }) },
      finishedAt: { db: 'finishedat', schema: t.string('Время окончания прогона', { format: 'date-time' }) },
      durationMs: { db: 'durationms', schema: t.number('Длительность в миллисекундах') },
      notes: { db: 'notes', schema: t.string('Заметки о прогоне') },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  SyncCursor: {
    table: 'sync_cursors',
    idField: 'id',
    required: ['stream', 'source'],
    search: ['stream', 'source', 'lastEventId'],
    fields: {
      stream: { db: 'stream', schema: t.string('Идентификатор потока синхронизации') },
      source: { db: 'source', schema: t.string('Источник маркетплейса', { enum: ['wildberries', 'yandex', 'ozon'] }) },
      lastEventId: { db: 'lasteventid', schema: t.string('ID последнего обработанного события') },
      lastTimestamp: { db: 'lasttimestamp', schema: t.string('Временная метка последнего события', { format: 'date-time' }) },
      updatedAt: { db: 'updatedat', schema: t.string('Когда был обновлен курсор', { format: 'date-time' }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  DeadLetter: {
    table: 'dead_letters',
    idField: 'id',
    required: ['stage', 'reason', 'payload'],
    search: ['runId', 'stage', 'reason', 'sourceEventId', 'traceId'],
    fields: {
      runId: { db: 'runid', schema: t.string('ID прогона, в котором произошла ошибка') },
      stage: { db: 'stage', schema: t.string('Этап pipeline где произошла ошибка', { enum: ['validate-input', 'collect-marketplace-data', 'normalize-events', 'save-raw-frames', 'save-events', 'update-snapshots', 'calculate-unit-economics', 'verify-results', 'build-report'] }) },
      reason: { db: 'reason', schema: t.string('Причина ошибки', { enum: ['validation_error', 'processing_error', 'schema_mismatch', 'signature_invalid', 'duplicate_event', 'collection_error', 'normalization_error', 'calculation_error'] }) },
      message: { db: 'message', schema: t.string('Описание ошибки') },
      sourceEventId: { db: 'sourceeventid', schema: t.string('ID события/товара/продавца в источнике') },
      payloadHash: { db: 'payloadhash', schema: t.string('SHA-256 хеш payload для дедупликации') },
      traceId: { db: 'traceid', schema: t.string('ID трассировки для логирования') },
      retryable: { db: 'retryable', schema: t.boolean('Можно ли повторить обработку') },
      payload: { db: 'payload', schema: t.object('Payload который не удалось обработать') },
      stackTrace: { db: 'stacktrace', schema: t.string('Stack trace ошибки') },
      resolvedAt: { db: 'resolvedat', schema: t.string('Когда ошибка была разрешена повторной обработкой', { format: 'date-time' }) },
      resolved: { db: 'resolved', schema: t.boolean('Была ли ошибка разрешена') },
      createdAt: { db: 'createdat', schema: t.string('Когда произошла ошибка', { format: 'date-time' }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  LogisticsDirectory: {
    table: 'logistics_directories',
    idField: 'id',
    required: ['source', 'direction_id', 'direction_name', 'tariffs'],
    search: ['source', 'direction_id', 'direction_name'],
    fields: {
      source: { db: 'source', schema: t.string('Источник справочника', { enum: ['wildberries', 'yandex', 'ozon'] }) },
      direction_id: { db: 'direction_id', schema: t.string('Уникальный идентификатор направления') },
      direction_name: { db: 'direction_name', schema: t.string('Название направления/склада') },
      tariffs: { db: 'tariffs', schema: t.object('Тарифы по схемам доставки') },
      raw_data: { db: 'raw_data', schema: t.object('Полные данные из справочника маркетплейса') },
      synced_at: { db: 'synced_at', schema: t.string('Время последней синхронизации', { format: 'date-time' }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  PriceHistory: {
    table: 'price_history',
    idField: 'id',
    required: ['product_id', 'date', 'our_price'],
    search: ['product_id', 'notes'],
    fields: {
      product_id: { db: 'product_id', schema: t.string('ID товара') },
      date: { db: 'date', schema: t.string('Дата записи цены', { format: 'date-time' }) },
      our_price: { db: 'our_price', schema: t.number('Наша цена продажи (₽)') },
      competitors: { db: 'competitors', schema: t.array('Цены конкурентов') },
      margin_pct: { db: 'margin_pct', schema: t.number('Маржинальность в % на момент записи') },
      cost: { db: 'cost', schema: t.number('Себестоимость товара (₽)') },
      notes: { db: 'notes', schema: t.string('Комментарий (изменение стратегии, акция и т.д.)') },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  SalesData: {
    table: 'sales_data',
    idField: 'id',
    required: ['product_id', 'period_start', 'period_end', 'units_sold', 'profit'],
    search: ['product_id', 'source'],
    fields: {
      product_id: { db: 'product_id', schema: t.string('ID товара') },
      period_start: { db: 'period_start', schema: t.string('Начало периода анализа', { format: 'date' }) },
      period_end: { db: 'period_end', schema: t.string('Конец периода анализа', { format: 'date' }) },
      units_sold: { db: 'units_sold', schema: t.number('Единиц продано') },
      revenue: { db: 'revenue', schema: t.number('Выручка (₽)') },
      cogs: { db: 'cogs', schema: t.number('Себестоимость (₽)') },
      profit: { db: 'profit', schema: t.number('Прибыль (₽)') },
      margin_pct: { db: 'margin_pct', schema: t.number('Маржинальность (%)') },
      avg_price: { db: 'avg_price', schema: t.number('Средняя цена продажи (₽)') },
      source: { db: 'source', schema: t.string('Источник данных', { enum: ['wildberries', 'yandex', 'ozon', 'manual'] }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  Subscription: {
    table: 'subscriptions',
    idField: 'id',
    required: ['name', 'slug'],
    search: ['name', 'slug', 'status'],
    fields: {
      name: { db: 'name', schema: t.string('Название пакета подписки') },
      slug: { db: 'slug', schema: t.string('Уникальный идентификатор пакета (basic, standard, standard_plus, maximum)') },
      description: { db: 'description', schema: t.string('Описание пакета') },
      price_monthly: { db: 'price_monthly', schema: t.number('Цена в месяц (рублей)') },
      price_annual: { db: 'price_annual', schema: t.number('Цена в год (рублей)') },
      is_default: { db: 'is_default', schema: t.boolean('Пакет по умолчанию для новых пользователей') },
      is_locked: { db: 'is_locked', schema: t.boolean('Неудаляемый пакет (базовый)') },
      features: { db: 'features', schema: t.array('Список ID функций, доступных в этом пакете', { type: 'string' }) },
      limits: { db: 'limits', schema: t.object('Лимиты на действия в пакете') },
      position: { db: 'position', schema: t.number('Порядок отображения пакета') },
      status: { db: 'status', schema: t.string('', { enum: ['active', 'inactive', 'archived'] }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  Feature: {
    table: 'features',
    idField: 'id',
    required: ['name', 'slug', 'category'],
    search: ['name', 'slug', 'category', 'status'],
    fields: {
      name: { db: 'name', schema: t.string('Название функции') },
      description: { db: 'description', schema: t.string('Описание функции') },
      slug: { db: 'slug', schema: t.string('Уникальный идентификатор функции') },
      category: { db: 'category', schema: t.string('Категория функции', { enum: ['products', 'analytics', 'automation', 'integrations', 'admin'] }) },
      requires_subscription: { db: 'requires_subscription', schema: t.boolean('Требует активную подписку') },
      is_premium: { db: 'is_premium', schema: t.boolean('Premium функция') },
      position: { db: 'position', schema: t.number('Порядок отображения в категории') },
      status: { db: 'status', schema: t.string('', { enum: ['active', 'inactive', 'beta'] }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  UserSubscription: {
    table: 'user_subscriptions',
    idField: 'id',
    required: ['user_email', 'subscription_id'],
    search: ['user_email', 'subscription_id', 'status'],
    fields: {
      user_email: { db: 'user_email', schema: t.string('Email пользователя') },
      subscription_id: { db: 'subscription_id', schema: t.string('ID пакета подписки') },
      status: { db: 'status', schema: t.string('Статус подписки', { enum: ['active', 'inactive', 'expired', 'cancelled'] }) },
      start_date: { db: 'start_date', schema: t.string('Дата начала подписки', { format: 'date' }) },
      end_date: { db: 'end_date', schema: t.string('Дата окончания подписки', { format: 'date' }) },
      billing_cycle: { db: 'billing_cycle', schema: t.string('Тип платёжного цикла', { enum: ['monthly', 'annual'] }) },
      auto_renew: { db: 'auto_renew', schema: t.boolean('Автоматическое продление') },
      notes: { db: 'notes', schema: t.string('Заметки администратора') },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  },
  User: {
    table: 'app_users',
    idField: 'id',
    required: ['email', 'full_name', 'role'],
    search: ['email', 'full_name', 'role'],
    fields: {
      email: { db: 'email', schema: t.string('The email of the user') },
      full_name: { db: 'full_name', schema: t.string('The full name of the user') },
      role: { db: 'role', schema: t.string('The role of the user in the app', { enum: ['admin', 'user'] }) },
      id: { db: 'id', schema: t.string('Unique record identifier') },
      created_date: { db: 'created_date', schema: t.string('Record creation timestamp', { format: 'date-time' }) },
      updated_date: { db: 'updated_date', schema: t.string('Record last update timestamp', { format: 'date-time' }) },
      created_by: { db: 'created_by', schema: t.string('Email of the user who created the record') }
    }
  }
};

export function getEntitySchema(def) {
  const properties = {};
  for (const [apiField, meta] of Object.entries(def.fields)) {
    properties[apiField] = meta.schema;
  }
  return {
    type: 'object',
    properties,
    required: def.required
  };
}
