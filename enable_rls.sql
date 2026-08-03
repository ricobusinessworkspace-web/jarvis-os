-- Enable RLS on Jarvis OS tables (Prisma bypasses this automatically)
ALTER TABLE IF EXISTS "jarvis_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_content_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_personal_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_knowledge_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_kpis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_trackers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_tracker_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_tracker_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "jarvis_weight_entries" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on Lightning CRM and G Project tables
ALTER TABLE IF EXISTS "crm_calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "crm_task_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "tracker_action_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "tracker_action_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "tracker_user_stats" ENABLE ROW LEVEL SECURITY;

-- Create Policies for Authenticated users to ensure apps work "ohne faxen"
CREATE POLICY "Allow all for authenticated" ON "crm_calls" FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON "crm_task_overrides" FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated" ON "tracker_action_entries" FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON "tracker_action_rules" FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON "tracker_user_stats" FOR ALL USING (auth.role() = 'authenticated');
