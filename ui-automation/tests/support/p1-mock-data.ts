import type { MockScenario } from './mock-data';
import { createMockLeaderScenario } from './mock-data';

/**
 * P1 testleri için özelleştirilmiş senaryo verisi üretir.
 * Mevcut leader senaryosunu alıp üzerine P1 durumlarını yamalar.
 */
export function createP1MockScenario(): MockScenario {
  const scenario = createMockLeaderScenario();

  // 1. Proje ID'sini sabitleyelim
  const activeProjectId = scenario.projects[0].id;

  // 2. Kritik Bug'lı Sürüm Adayı (rc-v1)
  const rcV1 = {
    ...scenario.releasesByProjectId[activeProjectId][0],
    id: 'rc-v1',
    title: 'Release V1 - Critical Bugs',
    status: 'DRAFT' as const,
    criticalOpenBugs: 2,
  };

  // 3. Hiç Koşulmamış Testli Sürüm Adayı (rc-v2-empty)
  const rcV2Empty = {
    ...rcV1,
    id: 'rc-v2-empty',
    title: 'Release V2 - Empty',
    untestedCount: 5,
    approvedTestCases: 0,
    readinessScore: 0,
  };

  scenario.releasesByProjectId[activeProjectId] = [rcV1, rcV2Empty];
  scenario.releaseAISummariesByCandidateId['rc-v1'] = scenario.releaseAISummariesByCandidateId[scenario.releasesByProjectId[activeProjectId][0].id];

  return scenario;
}
