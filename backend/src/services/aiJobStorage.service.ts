import prisma from '../utils/prisma';
import type { AIJobStatus } from '../types/aiJob';
import { Prisma } from '@prisma/client';

type EntityType = 'BusinessRequest' | 'WorkItem';

export async function setAIJob(entity: EntityType, id: string, aiJob: AIJobStatus): Promise<void> {
  const payload = JSON.stringify(aiJob);

  if (entity === 'BusinessRequest') {
    await prisma.$executeRaw`
      UPDATE "BusinessRequest"
      SET "aiJob" = ${payload}::jsonb, "updatedAt" = NOW()
      WHERE "id" = ${id}
    `;
    return;
  }

  await prisma.$executeRaw`
    UPDATE "WorkItem"
    SET "aiJob" = ${payload}::jsonb, "updatedAt" = NOW()
    WHERE "id" = ${id}
  `;
}

export async function getAIJob(entity: EntityType, id: string): Promise<AIJobStatus | null> {
  const rows = entity === 'BusinessRequest'
    ? await prisma.$queryRaw<Array<{ aiJob: AIJobStatus | null }>>`
      SELECT "aiJob"
      FROM "BusinessRequest"
      WHERE "id" = ${id}
      LIMIT 1
    `
    : await prisma.$queryRaw<Array<{ aiJob: AIJobStatus | null }>>`
      SELECT "aiJob"
      FROM "WorkItem"
      WHERE "id" = ${id}
      LIMIT 1
    `;

  return rows[0]?.aiJob ?? null;
}

export async function getAIJobs(entity: EntityType, ids: string[]): Promise<Record<string, AIJobStatus | null>> {
  if (ids.length === 0) {
    return {};
  }

  const rows = entity === 'BusinessRequest'
    ? await prisma.$queryRaw<Array<{ id: string; aiJob: AIJobStatus | null }>>`
      SELECT "id", "aiJob"
      FROM "BusinessRequest"
      WHERE "id" IN (${Prisma.join(ids)})
    `
    : await prisma.$queryRaw<Array<{ id: string; aiJob: AIJobStatus | null }>>`
      SELECT "id", "aiJob"
      FROM "WorkItem"
      WHERE "id" IN (${Prisma.join(ids)})
    `;

  return rows.reduce<Record<string, AIJobStatus | null>>((acc, row) => {
    acc[row.id] = row.aiJob ?? null;
    return acc;
  }, {});
}
