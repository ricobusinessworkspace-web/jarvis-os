const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const replacements = {
  '@@map("projects")': '@@map("jarvis_projects")',
  '@@map("goals")': '@@map("jarvis_goals")',
  '@@map("tasks")': '@@map("jarvis_tasks")',
  '@@map("content_items")': '@@map("jarvis_content_items")',
  '@@map("personal_logs")': '@@map("jarvis_personal_logs")',
  '@@map("settings")': '@@map("jarvis_settings")',
  '@@map("knowledge_items")': '@@map("jarvis_knowledge_items")',
  '@@map("kpis")': '@@map("jarvis_kpis")',
  '@@map("activities")': '@@map("jarvis_activities")',
  '@@map("trackers")': '@@map("jarvis_trackers")',
  '@@map("tracker_items")': '@@map("jarvis_tracker_items")',
  '@@map("tracker_logs")': '@@map("jarvis_tracker_logs")',
  '@@map("transactions")': '@@map("jarvis_transactions")'
};

for (const [oldVal, newVal] of Object.entries(replacements)) {
  schema = schema.replace(oldVal, newVal);
}

fs.writeFileSync(schemaPath, schema);
console.log("schema.prisma updated successfully.");
