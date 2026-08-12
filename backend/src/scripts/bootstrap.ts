import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required for the initial bootstrap`);
    return value;
}

async function bootstrap(): Promise<void> {
    const organizationSlug = required('DEFAULT_ORGANIZATION_SLUG');
    const organizationName = process.env.BOOTSTRAP_ORGANIZATION_NAME?.trim() || 'Nexa';
    const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
    const password = required('BOOTSTRAP_ADMIN_PASSWORD');
    const firstName = process.env.BOOTSTRAP_ADMIN_FIRST_NAME?.trim() || 'Nexa';
    const lastName = process.env.BOOTSTRAP_ADMIN_LAST_NAME?.trim() || 'Admin';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address');
    }
    if (password.length < 16) {
        throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 16 characters');
    }

    const organization = await prisma.organization.upsert({
        where: { slug: organizationSlug },
        create: { slug: organizationSlug, name: organizationName },
        update: {},
    });

    let administrator = await prisma.user.findUnique({ where: { email } });
    if (!administrator) {
        administrator = await prisma.user.create({
            data: {
                email,
                password: await bcrypt.hash(password, 12),
                firstName,
                lastName,
                role: Role.ADMIN,
                isActive: true,
                emailVerifiedAt: new Date(),
            },
        });
        console.log(`Initial administrator created: ${email}`);
    } else if (administrator.role !== Role.ADMIN) {
        throw new Error(`BOOTSTRAP_ADMIN_EMAIL belongs to a non-admin user: ${email}`);
    } else {
        console.log(`Initial administrator already exists: ${email}`);
    }

    await prisma.organizationMember.upsert({
        where: {
            organizationId_userId: {
                organizationId: organization.id,
                userId: administrator.id,
            },
        },
        create: {
            organizationId: organization.id,
            userId: administrator.id,
            isOwner: true,
        },
        update: { isOwner: true },
    });

    console.log(`Organization is ready: ${organization.slug}`);
}

bootstrap()
    .catch((error) => {
        console.error('Bootstrap failed:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
