const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.activity.deleteMany()
  await prisma.trackerLog.deleteMany()
  await prisma.trackerItem.deleteMany()
  await prisma.tracker.deleteMany()
  await prisma.task.deleteMany()
  await prisma.knowledgeItem.deleteMany()
  await prisma.goal.deleteMany()
  await prisma.kPI.deleteMany()
  await prisma.project.deleteMany()
  console.log('Database cleared of all mock data.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
