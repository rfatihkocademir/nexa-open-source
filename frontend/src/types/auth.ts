export type Role = 'ADMIN' | 'TESTER' | 'TEAM_LEADER' | 'PRODUCT_OWNER' | 'SCRUM_MASTER' | 'DEVELOPER' | 'ANALYST';

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    isActive: boolean;
    avatarUrl?: string | null;
    mfaEnabled?: boolean;
    language?: 'tr' | 'en';
}

export interface LoginResponse {
    user: User;
    token: string;
    projectPermissions?: Record<string, string[]>;
}
