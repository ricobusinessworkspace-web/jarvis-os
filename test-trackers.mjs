import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const today = new Date();
    const trackers = await prisma.tracker.findMany({
      include: {
        items: {
          include: {
            logs: {
              where: {
                date: {
                  gte: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
                }
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });
    console.log(JSON.stringify(trackers, null, 2));
}
run();
