import { CustomFieldType, WorkItemType } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

type JsonObject = Record<string, unknown>;

const normalizeKey = (value: unknown, label = 'key') => {
    if (typeof value !== 'string' || !value.trim()) throw new AppError(`${label} is required`, 400);
    const key = value.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key || key.length > 50) throw new AppError(`${label} must contain at most 50 letters, numbers or underscores`, 400);
    return key;
};

const requiredString = (value: unknown, label: string) => {
    if (typeof value !== 'string' || !value.trim()) throw new AppError(`${label} is required`, 400);
    return value.trim();
};

const parseJsonObject = (value: unknown, label: string): JsonObject | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'object' || Array.isArray(value)) throw new AppError(`${label} must be an object`, 400);
    return value as JsonObject;
};

export class WorkConfigurationService {
    async list(projectId: string) {
        const [workTypes, customFields] = await Promise.all([
            prisma.workTypeDefinition.findMany({ where: { projectId }, orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }] }),
            prisma.customFieldDefinition.findMany({ where: { projectId }, orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }] }),
        ]);
        return { workTypes, customFields };
    }

    async createWorkType(projectId: string, input: JsonObject) {
        const baseType = String(input.baseType || '').toUpperCase() as WorkItemType;
        if (!Object.values(WorkItemType).includes(baseType)) throw new AppError('Invalid baseType', 400);
        return prisma.workTypeDefinition.create({
            data: {
                projectId,
                key: normalizeKey(input.key),
                name: requiredString(input.name, 'name'),
                description: typeof input.description === 'string' ? input.description.trim() || null : null,
                baseType,
                icon: typeof input.icon === 'string' ? input.icon.trim() || null : null,
                color: typeof input.color === 'string' ? input.color.trim() || null : null,
                orderIndex: Number.isInteger(input.orderIndex) ? Number(input.orderIndex) : 0,
            },
        });
    }

    async updateWorkType(projectId: string, id: string, input: JsonObject) {
        await this.assertWorkType(projectId, id);
        const data: JsonObject = {};
        if ('name' in input) data.name = requiredString(input.name, 'name');
        if ('description' in input) data.description = typeof input.description === 'string' ? input.description.trim() || null : null;
        if ('icon' in input) data.icon = typeof input.icon === 'string' ? input.icon.trim() || null : null;
        if ('color' in input) data.color = typeof input.color === 'string' ? input.color.trim() || null : null;
        if ('orderIndex' in input) data.orderIndex = Number(input.orderIndex);
        if ('isActive' in input) data.isActive = Boolean(input.isActive);
        return prisma.workTypeDefinition.update({ where: { id }, data });
    }

    async createCustomField(projectId: string, input: JsonObject) {
        const fieldType = String(input.fieldType || '').toUpperCase() as CustomFieldType;
        if (!Object.values(CustomFieldType).includes(fieldType)) throw new AppError('Invalid fieldType', 400);
        const itemTypeKeys = Array.isArray(input.itemTypeKeys)
            ? input.itemTypeKeys.map((value) => normalizeKey(value, 'itemTypeKeys'))
            : [];
        const options = input.options === undefined ? undefined : input.options;
        this.assertOptions(fieldType, options);
        return prisma.customFieldDefinition.create({
            data: {
                projectId,
                key: normalizeKey(input.key),
                name: requiredString(input.name, 'name'),
                description: typeof input.description === 'string' ? input.description.trim() || null : null,
                fieldType,
                itemTypeKeys,
                required: Boolean(input.required),
                defaultValue: input.defaultValue as never,
                options: options as never,
                validation: parseJsonObject(input.validation, 'validation') as never,
                orderIndex: Number.isInteger(input.orderIndex) ? Number(input.orderIndex) : 0,
            },
        });
    }

    async updateCustomField(projectId: string, id: string, input: JsonObject) {
        const existing = await this.assertCustomField(projectId, id);
        const data: JsonObject = {};
        if ('name' in input) data.name = requiredString(input.name, 'name');
        if ('description' in input) data.description = typeof input.description === 'string' ? input.description.trim() || null : null;
        if ('itemTypeKeys' in input) data.itemTypeKeys = Array.isArray(input.itemTypeKeys)
            ? input.itemTypeKeys.map((value) => normalizeKey(value, 'itemTypeKeys'))
            : [];
        if ('required' in input) data.required = Boolean(input.required);
        if ('defaultValue' in input) data.defaultValue = input.defaultValue;
        if ('options' in input) {
            this.assertOptions(existing.fieldType, input.options);
            data.options = input.options;
        }
        if ('validation' in input) data.validation = parseJsonObject(input.validation, 'validation') || null;
        if ('orderIndex' in input) data.orderIndex = Number(input.orderIndex);
        if ('isActive' in input) data.isActive = Boolean(input.isActive);
        return prisma.customFieldDefinition.update({ where: { id }, data: data as never });
    }

    async deleteCustomField(projectId: string, id: string) {
        await this.assertCustomField(projectId, id);
        await prisma.customFieldDefinition.delete({ where: { id } });
    }

    async validateWorkItemFields(projectId: string, itemType: WorkItemType, workTypeId: unknown, rawFields: unknown) {
        let contextKey: string = itemType;
        if (workTypeId) {
            const workType = await this.assertWorkType(projectId, String(workTypeId));
            if (!workType.isActive) throw new AppError('Selected work type is inactive', 400);
            if (workType.baseType !== itemType) throw new AppError('Selected work type is not compatible with itemType', 400);
            contextKey = workType.key;
        }
        const fields = rawFields === undefined || rawFields === null ? {} : rawFields;
        if (typeof fields !== 'object' || Array.isArray(fields)) throw new AppError('customFields must be an object', 400);
        const definitions = await prisma.customFieldDefinition.findMany({
            where: {
                projectId,
                isActive: true,
                OR: [{ itemTypeKeys: { isEmpty: true } }, { itemTypeKeys: { has: contextKey } }, { itemTypeKeys: { has: itemType } }],
            },
        });
        const values = { ...(fields as JsonObject) };
        for (const definition of definitions) {
            if (!(definition.key in values) && definition.defaultValue !== null) values[definition.key] = definition.defaultValue;
            const value = values[definition.key];
            if (definition.required && (value === undefined || value === null || value === '')) {
                throw new AppError(`${definition.name} is required`, 400);
            }
            if (value !== undefined && value !== null && value !== '') this.validateValue(definition, value);
        }
        return values;
    }

    private validateValue(definition: { name: string; fieldType: CustomFieldType; options: unknown; validation: unknown }, value: unknown) {
        const fail = () => { throw new AppError(`${definition.name} has an invalid value`, 400); };
        const stringTypes: CustomFieldType[] = [CustomFieldType.TEXT, CustomFieldType.TEXTAREA, CustomFieldType.URL, CustomFieldType.DATE, CustomFieldType.DATETIME, CustomFieldType.SELECT, CustomFieldType.USER];
        const arrayTypes: CustomFieldType[] = [CustomFieldType.MULTI_SELECT, CustomFieldType.MULTI_USER];
        if (stringTypes.includes(definition.fieldType) && typeof value !== 'string') fail();
        if (definition.fieldType === CustomFieldType.NUMBER && (typeof value !== 'number' || !Number.isFinite(value))) fail();
        if (definition.fieldType === CustomFieldType.BOOLEAN && typeof value !== 'boolean') fail();
        if (arrayTypes.includes(definition.fieldType) && !Array.isArray(value)) fail();
        if (definition.fieldType === CustomFieldType.URL) {
            try { new URL(String(value)); } catch { fail(); }
        }
        const options = Array.isArray(definition.options) ? definition.options.map(String) : [];
        if (definition.fieldType === CustomFieldType.SELECT && options.length && !options.includes(String(value))) fail();
        if (definition.fieldType === CustomFieldType.MULTI_SELECT && options.length && (value as unknown[]).some((entry) => !options.includes(String(entry)))) fail();
        const validation = parseJsonObject(definition.validation, 'validation') || {};
        if (typeof value === 'string') {
            if (typeof validation.minLength === 'number' && value.length < validation.minLength) fail();
            if (typeof validation.maxLength === 'number' && value.length > validation.maxLength) fail();
            if (typeof validation.pattern === 'string' && !new RegExp(validation.pattern).test(value)) fail();
        }
        if (typeof value === 'number') {
            if (typeof validation.min === 'number' && value < validation.min) fail();
            if (typeof validation.max === 'number' && value > validation.max) fail();
        }
    }

    private assertOptions(fieldType: CustomFieldType, options: unknown) {
        const optionTypes: CustomFieldType[] = [CustomFieldType.SELECT, CustomFieldType.MULTI_SELECT];
        if (!optionTypes.includes(fieldType)) return;
        if (!Array.isArray(options) || !options.length || options.some((value) => typeof value !== 'string' || !value.trim())) {
            throw new AppError('Select fields require a non-empty string options array', 400);
        }
    }

    private async assertWorkType(projectId: string, id: string) {
        const record = await prisma.workTypeDefinition.findFirst({ where: { id, projectId } });
        if (!record) throw new AppError('Work type not found', 404);
        return record;
    }

    private async assertCustomField(projectId: string, id: string) {
        const record = await prisma.customFieldDefinition.findFirst({ where: { id, projectId } });
        if (!record) throw new AppError('Custom field not found', 404);
        return record;
    }
}

export const workConfigurationService = new WorkConfigurationService();
