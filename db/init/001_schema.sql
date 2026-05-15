CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  wb_api_token TEXT,
  wb_api_token_ads TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'trial')),
  notes TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  wb_supplier_id TEXT,
  fixed_monthly NUMERIC,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  wb_sku TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  category TEXT,
  price NUMERIC,
  sale_price NUMERIC,
  discount_pct NUMERIC,
  wb_commission_pct NUMERIC,
  size_length_cm NUMERIC,
  size_width_cm NUMERIC,
  size_height_cm NUMERIC,
  weight_kg NUMERIC,
  fulfillment_mode TEXT CHECK (fulfillment_mode IN ('FBO', 'FBS')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  last_synced_at TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS calculations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT,
  fulfillment_mode TEXT CHECK (fulfillment_mode IN ('FBO', 'FBS')),
  tax_system TEXT CHECK (tax_system IN ('usn_income', 'usn_income_expense')),
  tax_pct NUMERIC,
  acquiring_pct NUMERIC,
  promo_pct NUMERIC,
  return_rate_pct NUMERIC,
  cogs_purchase NUMERIC,
  cogs_packaging NUMERIC,
  cogs_fulfillment NUMERIC,
  cogs_inbound_to_wb NUMERIC,
  waste_pct NUMERIC,
  cac NUMERIC,
  paid_share_pct NUMERIC,
  fixed_monthly NUMERIC,
  fbo_wb_logistics NUMERIC,
  fbo_storage NUMERIC,
  fbo_other NUMERIC,
  fbs_last_mile NUMERIC,
  fbs_ops NUMERIC,
  fbs_storage NUMERIC,
  fbs_other NUMERIC,
  return_loss NUMERIC,
  price_net NUMERIC,
  revenue_net NUMERIC,
  cogs_base NUMERIC,
  cogs_with_waste NUMERIC,
  var_cost NUMERIC,
  gross_profit NUMERIC,
  gross_margin_pct NUMERIC,
  marketing_cost NUMERIC,
  contribution NUMERIC,
  contribution_pct NUMERIC,
  bep_units NUMERIC,
  is_profitable BOOLEAN,
  wb_report JSONB,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS raw_marketplace_frames (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  schemaVersion TEXT,
  source TEXT NOT NULL CHECK (source IN ('wildberries', 'yandex', 'ozon')),
  stream TEXT NOT NULL,
  sourceEventId TEXT NOT NULL,
  payloadHash TEXT,
  emittedAt TIMESTAMPTZ,
  receivedAt TIMESTAMPTZ,
  traceId TEXT,
  payload JSONB NOT NULL,
  processingStatus TEXT DEFAULT 'received' CHECK (processingStatus IN ('received', 'processing', 'processed', 'failed')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS marketplace_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  schemaVersion TEXT,
  type TEXT NOT NULL CHECK (type IN ('product.update', 'product.delete', 'seller.update', 'seller.delete', 'order.created', 'order.updated')),
  source TEXT NOT NULL CHECK (source IN ('wildberries', 'yandex', 'ozon')),
  sourceEventId TEXT,
  traceId TEXT,
  data JSONB NOT NULL,
  createdAt TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS product_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  productId TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('wildberries', 'yandex', 'ozon')),
  externalId TEXT,
  name TEXT,
  sku TEXT,
  price NUMERIC,
  data JSONB NOT NULL,
  updatedAt TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS seller_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sellerId TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('wildberries', 'yandex', 'ozon')),
  name TEXT,
  rating NUMERIC,
  data JSONB NOT NULL,
  updatedAt TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS unit_economics_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  itemId TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('wildberries', 'yandex', 'ozon')),
  price NUMERIC,
  cost NUMERIC,
  margin NUMERIC,
  marginPct NUMERIC,
  metrics JSONB NOT NULL,
  updatedAt TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  runId TEXT,
  source TEXT NOT NULL CHECK (source IN ('wildberries', 'yandex', 'ozon')),
  sourceMode TEXT CHECK (sourceMode IN ('real', 'mock', 'fallback')),
  mode TEXT CHECK (mode IN ('product', 'seller', 'full')),
  stream TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled', 'partial')),
  progress NUMERIC,
  currentStage TEXT,
  request JSONB,
  counters JSONB,
  timeline JSONB,
  errors JSONB,
  report JSONB,
  startedAt TIMESTAMPTZ,
  finishedAt TIMESTAMPTZ,
  durationMs NUMERIC,
  notes TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS sync_cursors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  stream TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('wildberries', 'yandex', 'ozon')),
  lastEventId TEXT,
  lastTimestamp TIMESTAMPTZ,
  updatedAt TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS dead_letters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  runId TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('validate-input', 'collect-marketplace-data', 'normalize-events', 'save-raw-frames', 'save-events', 'update-snapshots', 'calculate-unit-economics', 'verify-results', 'build-report')),
  reason TEXT NOT NULL CHECK (reason IN ('validation_error', 'processing_error', 'schema_mismatch', 'signature_invalid', 'duplicate_event', 'collection_error', 'normalization_error', 'calculation_error')),
  message TEXT,
  sourceEventId TEXT,
  payloadHash TEXT,
  traceId TEXT,
  retryable BOOLEAN DEFAULT true,
  payload JSONB NOT NULL,
  stackTrace TEXT,
  resolvedAt TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  createdAt TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS logistics_directories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source TEXT NOT NULL CHECK (source IN ('wildberries', 'yandex', 'ozon')),
  direction_id TEXT NOT NULL,
  direction_name TEXT NOT NULL,
  tariffs JSONB NOT NULL,
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS marketplace_commission_directories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source TEXT NOT NULL CHECK (source IN ('wildberries', 'yandex', 'ozon')),
  category_id TEXT NOT NULL,
  category_name TEXT NOT NULL,
  parent_category_id TEXT,
  parent_category_name TEXT,
  commission_pct NUMERIC,
  commission_by_model JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_data JSONB,
  synced_at TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_commission_owner_category
  ON marketplace_commission_directories(source, category_id, created_by);
CREATE INDEX IF NOT EXISTS idx_marketplace_commission_category_name
  ON marketplace_commission_directories(source, lower(category_name));

CREATE TABLE IF NOT EXISTS wb_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'done', 'failed', 'canceled')),
  article TEXT NOT NULL,
  product_id TEXT,
  project_id TEXT,
  client_id TEXT,
  user_email TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  progress NUMERIC DEFAULT 0,
  attempts NUMERIC DEFAULT 0,
  error TEXT,
  error_stage TEXT,
  error_endpoint TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wb_jobs_status_updated ON wb_jobs(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wb_jobs_article_updated ON wb_jobs(article, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_wb_jobs_user_updated ON wb_jobs(user_email, updated_at DESC);

CREATE TABLE IF NOT EXISTS wb_raw (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  article TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL,
  user_email TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wb_raw_article_fetched ON wb_raw(article, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_wb_raw_user_fetched ON wb_raw(user_email, fetched_at DESC);

CREATE TABLE IF NOT EXISTS admin_metric_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cpu_load_pct NUMERIC NOT NULL DEFAULT 0,
  memory_used_bytes BIGINT NOT NULL DEFAULT 0,
  memory_limit_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_metric_snapshots_created
  ON admin_metric_snapshots(created_at DESC);

CREATE TABLE IF NOT EXISTS user_activity (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT,
  user_email TEXT NOT NULL,
  session_id TEXT NOT NULL,
  path TEXT,
  user_agent TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_email, session_id)
);

CREATE INDEX IF NOT EXISTS idx_user_activity_last_seen
  ON user_activity(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_email_last_seen
  ON user_activity(user_email, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS activity_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT NOT NULL,
  path TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_activity_sessions_user
  ON activity_sessions(user_email, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_sessions_expires
  ON activity_sessions(expires_at);

CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  category TEXT NOT NULL DEFAULT 'notification',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'scheduled', 'canceled')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  attempt_count NUMERIC NOT NULL DEFAULT 0,
  max_attempts NUMERIC NOT NULL DEFAULT 1,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  recipient_count NUMERIC NOT NULL DEFAULT 0,
  delivered_count NUMERIC NOT NULL DEFAULT 0,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_status_created
  ON admin_broadcasts(status, created_date DESC);

CREATE TABLE IF NOT EXISTS user_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  broadcast_id TEXT REFERENCES admin_broadcasts(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'notification',
  read_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_messages_user_created
  ON user_messages(user_email, created_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_messages_user_unread
  ON user_messages(user_email, read_at) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS broadcast_schedules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  category TEXT NOT NULL DEFAULT 'notification',
  cadence TEXT NOT NULL DEFAULT 'once' CHECK (cadence IN ('once', 'daily', 'weekly', 'subscription_expiring')),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'canceled', 'failed')),
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  attempt_count NUMERIC NOT NULL DEFAULT 0,
  max_attempts NUMERIC NOT NULL DEFAULT 3,
  recipient_count NUMERIC NOT NULL DEFAULT 0,
  delivered_count NUMERIC NOT NULL DEFAULT 0,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_broadcast_schedules_due
  ON broadcast_schedules(status, next_run_at);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cadence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_due
  ON scheduled_tasks(status, next_run_at, locked_until);

CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL,
  task_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms NUMERIC,
  result JSONB,
  error TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_task_started
  ON sync_logs(task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started
  ON sync_logs(started_at DESC);

CREATE TABLE IF NOT EXISTS system_scheduled_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cadence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  last_result JSONB,
  failure_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_scheduled_tasks_due
  ON system_scheduled_tasks(status, next_run_at, locked_until);

CREATE TABLE IF NOT EXISTS system_task_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES system_scheduled_tasks(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL DEFAULT 'scheduled' CHECK (trigger IN ('scheduled', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms NUMERIC,
  result JSONB,
  error TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_task_runs_task_started
  ON system_task_runs(task_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_task_runs_started
  ON system_task_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id TEXT PRIMARY KEY,
  process_id NUMERIC,
  queue_name TEXT,
  host_name TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_heartbeats_last_seen
  ON worker_heartbeats(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  our_price NUMERIC NOT NULL,
  competitors JSONB,
  margin_pct NUMERIC,
  cost NUMERIC,
  notes TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS sales_data (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  units_sold NUMERIC NOT NULL,
  revenue NUMERIC,
  cogs NUMERIC,
  profit NUMERIC NOT NULL,
  margin_pct NUMERIC,
  avg_price NUMERIC,
  source TEXT CHECK (source IN ('wildberries', 'yandex', 'ozon', 'manual')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly NUMERIC,
  price_annual NUMERIC,
  is_default BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  features JSONB,
  limits JSONB,
  position NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('products', 'analytics', 'automation', 'integrations', 'admin')),
  requires_subscription BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  position NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'beta')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_email TEXT NOT NULL,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired', 'cancelled')),
  start_date DATE,
  end_date DATE,
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  auto_renew BOOLEAN DEFAULT true,
  notes TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);
