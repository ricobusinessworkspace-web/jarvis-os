-- ============================================================
--  Mail-Layer — Anschreiben an Leads
--  Idempotent. Legt nur an, löscht nie.
--
--  Bewusst getrennt vom Semantic Layer (core_*): eine Mail ist keine
--  Metrik. Sie wird nicht gemessen, sie wird geschrieben.
--
--  WICHTIG: NICHT `prisma db push` benutzen — siehe core-layer.sql.
-- ============================================================

-- ── Vorlagen ───────────────────────────────────────────────
--  Eine Vorlage ist zweierlei:
--  `body`     — das Gerüst mit Platzhaltern, für den Weg ohne Modell.
--  `guidance` — die Anweisung an Claude, wenn es die Mail individuell
--               schreiben soll. Hier steht, was NICHT erfunden werden darf.
CREATE TABLE IF NOT EXISTS mail_templates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  subject    TEXT        NOT NULL DEFAULT '',
  body       TEXT        NOT NULL DEFAULT '',
  guidance   TEXT        NOT NULL DEFAULT '',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mail_templates_order
  ON mail_templates (sort_order)
  WHERE is_active;

-- ── Entwürfe ───────────────────────────────────────────────
--  Kein Fremdschlüssel auf crm_leads: das CRM ist eine fremde Anwendung,
--  auf die Jarvis nur lesend zugreift. Eine FK würde sein Löschverhalten
--  an Jarvis koppeln.
--
--  `task_key` ist die CRM-Aufgabe, aus der der Entwurf entstanden ist
--  (`<lead_id>:<task_id>`, wie TaskInboxService sie bildet). NULL heißt
--  „von Hand in Jarvis angelegt" — nicht „Aufgabe unbekannt".
--
--  Der Kontext steht in eigenen Spalten und nicht im fertigen Text, damit
--  er beim Neuschreiben erhalten bleibt.
CREATE TABLE IF NOT EXISTS mail_drafts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        BIGINT      NOT NULL,
  task_key       TEXT,
  template_id    UUID        REFERENCES mail_templates(id) ON DELETE SET NULL,
  to_email       TEXT        NOT NULL DEFAULT '',
  subject        TEXT        NOT NULL DEFAULT '',
  body           TEXT        NOT NULL DEFAULT '',
  gespraech_am   DATE,
  gesprochen_mit TEXT        NOT NULL DEFAULT '',
  thema          TEXT        NOT NULL DEFAULT '',
  -- offen = Kontext da, kein Text · entwurf = Text da · freigegeben = von Rico
  -- geprüft · gesendet = raus. Kein Zustand wird übersprungen.
  status         TEXT        NOT NULL DEFAULT 'offen',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at        TIMESTAMPTZ
);

-- Eine CRM-Aufgabe erzeugt höchstens einen Entwurf.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mail_drafts_task
  ON mail_drafts (task_key)
  WHERE task_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mail_drafts_offen
  ON mail_drafts (status, updated_at DESC);
