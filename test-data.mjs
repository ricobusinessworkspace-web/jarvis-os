import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("--- PersonalLogs ---");
  const logs = await prisma.personalLog.findMany({ orderBy: { date: 'desc' }, take: 5 });
  console.log(logs);

  console.log("\n--- TrackerLogs ---");
  const tlogs = await prisma.trackerLog.findMany({ orderBy: { date: 'desc' }, take: 5 });
  console.log(tlogs);

  console.log("\n--- Tasks ---");
  const tasks = await prisma.task.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log(tasks.map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, typeOfDueDate: typeof t.dueDate })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
