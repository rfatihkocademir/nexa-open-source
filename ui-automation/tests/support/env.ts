export type AutomationMode = 'mock' | 'live';

export const appUrl = process.env.UI_AUTOMATION_APP_URL || 'http://127.0.0.1:5173';
export const apiUrl = process.env.UI_AUTOMATION_API_URL || 'http://127.0.0.1:1996/api/v1';
export const mode: AutomationMode = process.env.UI_AUTOMATION_MODE === 'live' ? 'live' : 'mock';

export const isMockMode = mode === 'mock';
export const isLiveMode = mode === 'live';
