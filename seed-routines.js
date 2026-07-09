const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding routines...");
  
  // Morning Routine
  const morningTracker = await prisma.tracker.create({
    data: {
      name: 'Morgenroutine',
      type: 'routine',
      description: 'Start the day right',
      items: {
        create: [
          { title: 'Aufstehen & Wasser trinken', icon: 'Sun', order: 1, expectedDuration: 5, startWindow: '06:00-06:15' },
          { title: 'Meditation (10 min)', icon: 'Brain', order: 2, expectedDuration: 10, startWindow: '06:15-06:30' },
          { title: 'Workout / Stretching', icon: 'Dumbbell', order: 3, expectedDuration: 30, startWindow: '06:30-07:00' },
          { title: 'Duschen (Kalt)', icon: 'Droplets', order: 4, expectedDuration: 10, startWindow: '07:00-07:15' },
          { title: 'Lesen (15 min)', icon: 'BookOpen', order: 5, expectedDuration: 15, startWindow: '07:15-07:30' },
          { title: 'Tagesplanung (Jarvis OS)', icon: 'Target', order: 6, expectedDuration: 15, startWindow: '07:30-07:45' },
        ]
      }
    }
  });

  // Evening Routine
  const eveningTracker = await prisma.tracker.create({
    data: {
      name: 'Abendroutine',
      type: 'routine',
      description: 'Wind down and reflect',
      items: {
        create: [
          { title: 'Handy weglegen', icon: 'SmartphoneOff', order: 1, expectedDuration: 5, startWindow: '21:00-21:05' },
          { title: 'Tagesreflexion (Journal)', icon: 'Book', order: 2, expectedDuration: 10, startWindow: '21:05-21:15' },
          { title: 'Morgen planen', icon: 'Calendar', order: 3, expectedDuration: 10, startWindow: '21:15-21:25' },
          { title: 'Lesen (Fiction)', icon: 'BookOpen', order: 4, expectedDuration: 30, startWindow: '21:30-22:00' },
          { title: 'Schlafen', icon: 'Moon', order: 5, expectedDuration: 0, startWindow: '22:00' },
        ]
      }
    }
  });

  console.log("Routines seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
