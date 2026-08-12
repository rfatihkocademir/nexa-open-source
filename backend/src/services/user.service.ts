import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';
import bcrypt from 'bcryptjs';
import { CreateUserInput, UpdateUserInput, UserSummary } from '../types/user';

export class UserService {
    async getMe(userId: string): Promise<UserSummary> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                avatarUrl: true,
                mfaEnabled: true,
            },
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }

        return user as UserSummary;
    }

    async updateMe(userId: string, data: Partial<UpdateUserInput>): Promise<UserSummary> {
        const { firstName, lastName, password, avatarUrl } = data;

        let dataToUpdate: any = {};
        if (firstName) dataToUpdate.firstName = firstName;
        if (lastName) dataToUpdate.lastName = lastName;
        if (avatarUrl !== undefined) dataToUpdate.avatarUrl = avatarUrl;
        
        if (password) {
            dataToUpdate.password = await bcrypt.hash(password, 10);
            dataToUpdate.tokenVersion = { increment: 1 };
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: dataToUpdate,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                avatarUrl: true,
            },
        });

        if (password) await prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

        return user as UserSummary;
    }

    async create(data: CreateUserInput, organizationId: string): Promise<UserSummary> {
        const { email, password, firstName, lastName, role } = data;

        if (!email?.trim() || !firstName?.trim() || !lastName?.trim()) {
            throw new AppError('Email, first name and last name are required', 400);
        }

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { id: true },
        });
        if (!organization) {
            throw new AppError('Organization not found', 404);
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new AppError('Email already in use', 400);
        }

        if (!password) throw new AppError('A temporary password of at least 12 characters is required', 400);
        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                role,
                avatarUrl: data.avatarUrl,
                isActive: data.isActive ?? true,
                organizationMemberships: { create: { organizationId } },
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                avatarUrl: true,
            },
        });

        return user as UserSummary;
    }

    async getAllUsers(organizationId: string): Promise<UserSummary[]> {
        const users = await prisma.user.findMany({
            where: {
                deletedAt: null,
                organizationMemberships: { some: { organizationId } },
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                avatarUrl: true,
            },
        });

        return users as UserSummary[];
    }

    async getById(id: string, organizationId: string) {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                avatarUrl: true,
                deletedAt: true,
                members: {
                    include: {
                        project: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            },
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }
        const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: id } } });
        if (!membership) throw new AppError('User not found', 404);

        return user;
    }

    async update(id: string, data: UpdateUserInput, organizationId: string): Promise<UserSummary> {
        await this.assertOrganizationMembership(id, organizationId);
        const { firstName, lastName, role, isActive, password, avatarUrl } = data;

        let dataToUpdate: any = {};
        if (firstName) dataToUpdate.firstName = firstName;
        if (lastName) dataToUpdate.lastName = lastName;
        if (role) dataToUpdate.role = role;
        if (isActive !== undefined) dataToUpdate.isActive = isActive;
        if (avatarUrl !== undefined) dataToUpdate.avatarUrl = avatarUrl;

        if (password) {
            dataToUpdate.password = await bcrypt.hash(password, 10);
        }
        if (password || role || isActive === false) dataToUpdate.tokenVersion = { increment: 1 };

        const user = await prisma.user.update({
            where: { id },
            data: dataToUpdate,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                avatarUrl: true,
            },
        });

        if (password || role || isActive === false) await prisma.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });

        return user as UserSummary;
    }

    async delete(id: string, organizationId: string) {
        await this.assertOrganizationMembership(id, organizationId);
        await prisma.user.update({
            where: { id },
            data: {
                isActive: false,
                deletedAt: new Date(),
                tokenVersion: { increment: 1 },
            },
        });
        await prisma.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }

    private async assertOrganizationMembership(userId: string, organizationId: string) {
        const membership = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
        if (!membership) throw new AppError('User not found', 404);
    }
}

export const userService = new UserService();
