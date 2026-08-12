import prisma from '../utils/prisma';
import { encryptJson } from '../utils/crypto';

async function main() {
    const integrations = await prisma.integration.findMany({ select: { id: true, config: true } });
    let encrypted = 0;
    for (const integration of integrations) {
        const value = integration.config as Record<string, unknown> | null;
        if (value && typeof value === 'object' && value._encrypted) continue;
        await prisma.integration.update({ where: { id: integration.id }, data: { config: encryptJson(integration.config) } });
        encrypted += 1;
    }
    console.log(`Encrypted ${encrypted} integration configuration(s).`);
}

main().finally(() => prisma.$disconnect());
