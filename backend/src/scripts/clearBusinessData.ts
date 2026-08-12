import prisma from '../utils/prisma';

const CONFIRMATION = 'CLEAR_NEXA_BUSINESS_DATA';
const protectedTables = new Set(['User', 'Organization', 'OrganizationMember', '_prisma_migrations']);

async function main() {
    if (process.env.NEXA_DATA_CLEAR_CONFIRM !== CONFIRMATION) {
        throw new Error(`Refusing destructive cleanup. Set NEXA_DATA_CLEAR_CONFIRM=${CONFIRMATION}.`);
    }

    const rows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const targets = rows.map((row) => row.tablename).filter((name) => !protectedTables.has(name));
    if (targets.length === 0) return;
    if (targets.some((name) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))) {
        throw new Error('Unsafe table name detected; cleanup aborted.');
    }

    const quotedTargets = targets.map((name) => `"${name}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTargets} RESTART IDENTITY CASCADE`);

    const [users, organizations, memberships] = await Promise.all([
        prisma.user.count(),
        prisma.organization.count(),
        prisma.organizationMember.count(),
    ]);
    console.log(JSON.stringify({ truncatedTables: targets.length, preserved: { users, organizations, memberships } }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
