import { RoutineService } from './RoutineService';
import { TaskService } from './TaskService';
import { ContentService } from './ContentService';
import { CrmService } from './CrmService';

export class BriefingService {
  static async getMorningBriefing() {
    try {
      // 1. Wetter & Ort via IP
      let weatherStr = "Wetterdaten nicht verfügbar";
      let location = "Unbekannt";
      try {
        const ipRes = await fetch('http://ip-api.com/json/');
        const ipData = await ipRes.json();
        if (ipData && ipData.lat && ipData.lon) {
          location = ipData.city || 'Deinem Standort';
          const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${ipData.lat}&longitude=${ipData.lon}&current_weather=true`);
          const weatherData = await weatherRes.json();
          const w = weatherData.current_weather;
          weatherStr = `${w.temperature}°C, Windgeschw. ${w.windspeed} km/h`;
        }
      } catch (e) {
        console.error("Wetter API Error:", e);
      }

      // 2. Health & Sleep
      const health = await RoutineService.getHealthAndSleepData();
      
      // 3. Top Tasks
      const tasksRes = await TaskService.getTasks();
      const topTasks = (tasksRes as any).tasks?.slice(0, 3) || [];

      // 4. Content Pipeline
      const contentRes = await ContentService.getContentPipeline();
      const contentToday = (contentRes as any).items?.slice(0, 2) || [];

      // 5. Routinen
      const routinesRes = await RoutineService.getTodayRoutines();
      const openRoutines = (routinesRes as any).routines?.filter((r: any) => r.status !== 'completed') || [];

      // 6. CRM Update
      const crm = await CrmService.getOverview();

      const now = new Date();
      const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

      return {
        _instruction: "Lies das folgende Update extrem kurz, sarkastisch und natürlich vor. Nutze maximal 2 Sätze. Erfinde absolut nichts dazu!",
        daten: `Wetter: ${weatherStr} in ${location}.
Uhrzeit: ${timeStr}.
Schlaf letzte Nacht: ${health.todaySleep?.sleepHours || 'Nicht getrackt'} Stunden.
5 AM Club Streak: ${health.streak || 0} Tage.
Offene Aufgaben (Tasks): ${topTasks.length}.
Offene Routinen: ${openRoutines.length}.
Content in Pipeline: ${contentToday.length}.
CRM Anrufe heute: ${(crm as any).callsToday || 0}.`
      };
    } catch (err: any) {
      return { error: err.message };
    }
  }
}
