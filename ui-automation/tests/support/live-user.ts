import { apiUrl } from './env';

export interface LiveCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RegisteredLiveUser {
  credentials: LiveCredentials;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  };
  token: string;
}

function randomEmail() {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `ui-${Date.now()}-${suffix}@nexa.test`;
}

export async function registerLiveUser(overrides: Partial<LiveCredentials> = {}): Promise<RegisteredLiveUser> {
  const credentials: LiveCredentials = {
    email: overrides.email || randomEmail(),
    password: overrides.password || 'Password123!',
    firstName: overrides.firstName || 'UI',
    lastName: overrides.lastName || 'Tester',
  };

  const response = await fetch(`${apiUrl}/auth/register`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || `Kullanıcı kaydı başarısız oldu (${response.status})`;
    throw new Error(message);
  }

  return {
    credentials,
    user: payload.data.user,
    token: payload.data.token,
  };
}
