import { prisma } from '../src/database/client';

beforeEach(async () => {
  await prisma.workflow.deleteMany({});
  await prisma.transcript.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.call.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});
