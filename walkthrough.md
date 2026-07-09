# Jarvis OS - Bugfixes & System Updates

## 1. Local State Editing Bugs Fixed
The primary reason you were unable to edit Projects, link Goals to Projects, or link Tasks to Projects was a local state caching bug. When you opened a modal, it held a stale snapshot of the item instead of reacting to database updates.
**Fix**: Refactored the dashboard pages (`projects/page.tsx`, `tasks/page.tsx`, `goals/page.tsx`, `knowledge/page.tsx`) to store the ID of the selected item rather than the object itself. Changes now correctly sync with the global Zustand store and the UI reflects them instantly.

## 2. Knowledge to Goal Linking
The `KnowledgeItem` model was missing a foreign key relationship to the `Goal` model in the Prisma schema.
**Fix**: 
- Added `goalId` to the `KnowledgeItem` model in `schema.prisma`.
- Ran `npx prisma db push` to update your Supabase database schema.
- Added a "Goal" dropdown to the `NewNoteModal` and `ViewNoteModal`. You can now explicitly link any Knowledge entry to an overarching Goal.

## 3. Removal of Mock Data
The `PerformanceCharts.tsx` widget on your dashboard was responsible for the random "Revenue Pipeline", "Creator Audience Growth", and "Active Minutes" values. These were purely placeholder visualizations.
**Fix**: I have removed this widget from the default layout. The system now solely relies on your actual database entries and the `SalesEngineWidget` which dynamically fetches your true calling metrics via the Electron CRM Bridge.

## 4. Routines Restored
The reason your Morning and Evening routines vanished is because the `clear-db.js` script (which I used to wipe out the mock projects/tasks earlier) also wiped out the `Tracker` table. 
**Fix**: I wrote a quick seeder script and manually restored both your `Morgenroutine` and `Abendroutine` directly into the database.

> [!TIP]
> **Dashboard Layout Reset:** Because the dashboard caches your layout in `localStorage`, the routines widget might not automatically snap back if your browser remembers the old layout. Simply click the **Settings** icon on your dashboard and select **"Reset Layout"** to reload the correct widget columns!
