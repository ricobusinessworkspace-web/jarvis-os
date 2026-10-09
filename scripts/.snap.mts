import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const tag = process.argv[2];
const logs = await p.trackerLog.findMany({ where: { date: new Date(`${tag}T00:00:00.000Z`) }, select: { id: true, status: true, item: { select: { title: true, tracker: { select: { name: true } } } } } });
console.log(JSON.stringify(logs.map(l => [l.item.tracker.name, l.item.title, l.status, l.id])));
await p.$disconnect();
