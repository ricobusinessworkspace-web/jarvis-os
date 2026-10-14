-- Supabase-Sicherheitswarnungen schließen (geprüft am 14.10.2026).
-- Ausführen im Supabase-Dashboard → SQL Editor. Wirkt sofort auf Dev und Production.
-- Rückgängig: jeweils `disable row level security` / `security_invoker = false`.

-- 1. Jarvis-Tabellen: öffentliche REST-Schnittstelle sperren.
--    Jarvis liest per Prisma als `postgres` (BYPASSRLS) und merkt davon nichts.
--    Weder CRM noch Kurzbefehle noch Skripte nutzen diese Tabellen über REST.
alter table public.core_metric_definitions enable row level security;
alter table public.core_metric_sources enable row level security;
alter table public.core_intentions enable row level security;
alter table public.core_goals enable row level security;
alter table public.core_manual_values enable row level security;
alter table public.ingest_reminders enable row level security;
alter table public.ingest_health_daily enable row level security;
alter table public.ingest_health_targets enable row level security;
alter table public.ingest_status enable row level security;
alter table public.mail_templates enable row level security;
alter table public.mail_drafts enable row level security;
alter table public.mcp_write_log enable row level security;

-- 2. CRM-Ansicht `lead_timeline`: mit den Rechten des Lesenden statt des Erstellers.
--    crm_calls und lead_activities erlauben angemeldeten Nutzern alles, anon nichts —
--    das CRM sieht also dasselbe wie vorher, Fremde nichts mehr.
alter view public.lead_timeline set (security_invoker = true);

-- 3. Trigger-Funktionen mit festem search_path.
alter function public.handle_new_user() set search_path = public;
alter function public.recalculate_user_stats() set search_path = public;
alter function public.atomic_increment_stats() set search_path = public;

-- 4. handle_new_user ist nur der Trigger auf auth.users — nicht per API aufrufbar.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 5. Erweiterung `vector` aus public (eine ungenutzte Spalte; `extensions` liegt im search_path).
alter extension vector set schema extensions;

-- Bewusst NICHT: `pg_net` verschieben. Geht nur per Löschen + Neuanlegen und
-- treibt die minütliche Rückruf-Zeitschaltuhr des CRM (pg_cron + pg_net).
