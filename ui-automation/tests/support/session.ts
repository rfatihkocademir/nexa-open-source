import type { Page } from '@playwright/test';

import { isMockMode } from './env';
import type { MockScenario } from './mock-data';
import { createMockLeaderScenario, createMockTesterScenario, createMockWorkspaceScenario } from './mock-data';
import { installMockApi } from './mock-api';
import { registerLiveUser, type RegisteredLiveUser } from './live-user';

export type SessionRole = 'TESTER' | 'TEAM_LEADER' | 'ADMIN';

export type PreparedSession = RegisteredLiveUser & {
  scenario?: MockScenario;
};

export async function prepareSession(page: Page, role: SessionRole): Promise<PreparedSession> {
  if (!isMockMode) {
    return registerLiveUser({
      firstName: role === 'TEAM_LEADER' ? 'Ayşe' : role === 'ADMIN' ? 'Aylin' : 'Zeynep',
      lastName: role === 'TEAM_LEADER' ? 'Demir' : role === 'ADMIN' ? 'Kara' : 'Acar',
    });
  }

  const scenario =
    role === 'TEAM_LEADER'
      ? createMockLeaderScenario()
      : role === 'ADMIN'
        ? createMockWorkspaceScenario('ADMIN')
        : createMockTesterScenario();
  await installMockApi(page, scenario);
  return {
    credentials: {
      email: scenario.auth.credentials.email,
      password: scenario.auth.credentials.password,
      firstName: scenario.auth.user.firstName,
      lastName: scenario.auth.user.lastName,
    },
    user: scenario.auth.user,
    token: scenario.auth.token,
    scenario,
  };
}
