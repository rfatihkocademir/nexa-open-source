import type { Page } from '@playwright/test';

import { prepareSession, type PreparedSession, type SessionRole } from './session';
import { signInThroughUi } from './ui';

export async function loginAs(page: Page, role: SessionRole): Promise<PreparedSession> {
  const session = await prepareSession(page, role);
  await signInThroughUi(page, session.credentials);
  return session;
}
