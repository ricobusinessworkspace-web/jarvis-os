-- ============================================================
--  Core Semantic Layer — Command Center
--  Idempotent. Legt nur an, löscht nie.
--
--  WICHTIG: NICHT `prisma db push` benutzen. Die Datenbank
--  enthält Tabellen fremder Apps (crm_*, g_*, lead_*,
--  user_profiles), die nicht in schema.prisma stehen — db push
--  würde sie löschen. Migrationen laufen über dieses Skript.
-- ============================================================

-- ── Metrik-Definitionen ────────────────────────────────────
CREATE TABLE IF NOT EXISTS core_metric_definitions (
  key         TEXT PRIMARY KEY,
  label       TEXT        NOT NULL,
  unit        TEXT        NOT NULL DEFAULT 'count',            -- count | hours | kcal | kg | pct | enum
  aggregation TEXT        NOT NULL DEFAULT 'sum',              -- sum | last | avg | ratio
  direction   TEXT        NOT NULL DEFAULT 'higher_is_better', -- higher_is_better | lower_is_better | neutral
  domain      TEXT        NOT NULL,                            -- body | business | code | social
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Quellen-Schicht (Automatik) ────────────────────────────
-- Pro Metrik eine geordnete Liste von Quellen. Der AnalyticsService
-- fragt sie nach priority ab und nimmt den ersten Treffer.
-- Neue Systeme anbinden = eine Zeile, kein neuer Code-Pfad.
CREATE TABLE IF NOT EXISTS core_metric_sources (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key TEXT        NOT NULL REFERENCES core_metric_definitions(key) ON DELETE CASCADE,
  kind       TEXT        NOT NULL,   -- crm_calls | tracker | personal_log | weight | health | reminders | gproject
  config     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  priority   INTEGER     NOT NULL DEFAULT 100,  -- kleiner = gewinnt
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_core_metric_sources_lookup
  ON core_metric_sources (metric_key, priority)
  WHERE is_active;

-- ── Tages-Intentionen (Soll-Werte, in der UI editierbar) ───
CREATE TABLE IF NOT EXISTS core_intentions (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key      TEXT             NOT NULL REFERENCES core_metric_definitions(key) ON DELETE CASCADE,
  base_value      DOUBLE PRECISION NOT NULL,
  stretch_value   DOUBLE PRECISION,
  comparator      TEXT             NOT NULL DEFAULT '>=',
  active_weekdays INTEGER[]        NOT NULL DEFAULT '{1,2,3,4,5,6}',  -- ISO: 1=Mo … 7=So
  valid_from      DATE             NOT NULL,
  valid_to        DATE,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- Höchstens eine laufende Intention je Metrik
CREATE UNIQUE INDEX IF NOT EXISTS uq_core_intentions_open
  ON core_intentions (metric_key)
  WHERE valid_to IS NULL;

-- ── Ziele ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS core_goals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  metric_key   TEXT        REFERENCES core_metric_definitions(key) ON DELETE SET NULL,
  target_value TEXT,                                  -- NULL = bewusst kein Ziel (Messphase)
  comparator   TEXT,
  horizon_end  DATE,
  status       TEXT        NOT NULL DEFAULT 'active', -- active | pending | reached | abandoned
  notes        TEXT        NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_core_goals_title ON core_goals (title);

-- ============================================================
--  Ingest-Schicht — was die iOS-Kurzbefehle hereinreichen
--
--  Apple Erinnerungen und Health haben keine Cloud-API. Beides kommt
--  über Kurzbefehl-Automationen vom iPhone an POST /api/ingest/apple.
--  Diese Tabellen sind reiner Cache: Apple bleibt die Wahrheit.
-- ============================================================

CREATE TABLE IF NOT EXISTS ingest_reminders (
  id         TEXT        PRIMARY KEY,   -- Erinnerungs-ID aus iOS
  title      TEXT        NOT NULL,
  list_name  TEXT        NOT NULL DEFAULT '',
  due_at     TIMESTAMPTZ,
  due_date   TEXT,                      -- YYYY-MM-DD Berliner Zeit, zum Filtern
  completed  BOOLEAN     NOT NULL DEFAULT FALSE,
  priority   INTEGER     NOT NULL DEFAULT 0,
  notes      TEXT        NOT NULL DEFAULT '',
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingest_reminders_due ON ingest_reminders (due_date);

CREATE TABLE IF NOT EXISTS ingest_health_daily (
  date       DATE             NOT NULL,
  metric_key TEXT             NOT NULL,
  value      DOUBLE PRECISION NOT NULL,
  synced_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
  PRIMARY KEY (date, metric_key)
);

-- Damit die UI ehrlich „verbunden / zuletzt vor 12 Minuten" sagen kann,
-- statt eine leere Liste als „nichts zu tun" auszugeben.
CREATE TABLE IF NOT EXISTS ingest_status (
  source     TEXT        PRIMARY KEY,   -- 'reminders' | 'health'
  synced_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  item_count INTEGER     NOT NULL DEFAULT 0
);
