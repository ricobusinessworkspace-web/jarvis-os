import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const setting = await prisma.setting.findUnique({ where: { key: 'google_calendar_token' } });
    console.log(setting?.value);
}
run();
