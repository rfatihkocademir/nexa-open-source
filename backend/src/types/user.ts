import { Role } from "@prisma/client";

export interface CreateUserInput {
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    role: Role;
    avatarUrl?: string | null;
    isActive?: boolean;
}

export interface UpdateUserInput {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    role?: Role;
    avatarUrl?: string | null;
    isActive?: boolean;
}

export interface UserFilters {
    role?: Role;
    isActive?: boolean;
    search?: string;
}

export interface UserSummary {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    isActive: boolean;
    avatarUrl: string | null;
}
