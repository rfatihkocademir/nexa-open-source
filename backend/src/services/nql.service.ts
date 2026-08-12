import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';

type SortDirection = 'asc' | 'desc';
type CompiledNql = { where: Prisma.WorkItemWhereInput; orderBy: Prisma.WorkItemOrderByWithRelationInput[] };

const FIELD_MAP: Record<string, string> = {
    type: 'itemType', itemtype: 'itemType', status: 'status', priority: 'priority',
    severity: 'severity', assignee: 'assigneeId', assigneeid: 'assigneeId',
    reporter: 'reporterId', reporterid: 'reporterId', sprint: 'sprintId', sprintid: 'sprintId',
    key: 'key', title: 'title', created: 'createdAt', createdat: 'createdAt',
    updated: 'updatedAt', updatedat: 'updatedAt', points: 'storyPoints', storypoints: 'storyPoints',
    worktype: 'workTypeId', worktypeid: 'workTypeId', text: '__text',
};
const ENUM_FIELDS = new Set(['itemType', 'status', 'priority', 'severity']);
const NUMBER_FIELDS = new Set(['storyPoints']);
const DATE_FIELDS = new Set(['createdAt', 'updatedAt']);
const SORTABLE = new Set(['key', 'title', 'createdAt', 'updatedAt', 'priority', 'status', 'storyPoints']);

const unquote = (value: string) => {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1).replace(/\\(["'\\])/g, '$1');
    }
    return trimmed;
};

const splitOutside = (input: string, separator: RegExp) => {
    const result: string[] = [];
    let quote = '';
    let depth = 0;
    let start = 0;
    for (let index = 0; index < input.length; index += 1) {
        const char = input[index];
        if (quote) {
            if (char === quote && input[index - 1] !== '\\') quote = '';
            continue;
        }
        if (char === '"' || char === "'") { quote = char; continue; }
        if (char === '(') depth += 1;
        if (char === ')') depth -= 1;
        if (depth === 0) {
            const rest = input.slice(index);
            const match = rest.match(separator);
            if (match?.index === 0) {
                result.push(input.slice(start, index).trim());
                index += match[0].length - 1;
                start = index + 1;
            }
        }
    }
    result.push(input.slice(start).trim());
    return result.filter(Boolean);
};

export class NqlService {
    compile(rawQuery: unknown, actorId: string): CompiledNql {
        if (typeof rawQuery !== 'string') throw new AppError('q must be a string', 400);
        const query = rawQuery.trim();
        if (query.length > 2000) throw new AppError('NQL query is too long', 400);
        if (!query) return { where: {}, orderBy: [{ updatedAt: 'desc' }] };

        const orderMatch = query.match(/\s+ORDER\s+BY\s+(.+)$/i);
        const expression = orderMatch ? query.slice(0, orderMatch.index).trim() : query;
        const orderBy = orderMatch ? this.parseOrderBy(orderMatch[1]) : [{ updatedAt: 'desc' as SortDirection }];
        const clauses = splitOutside(expression, /^\s+AND\s+/i);
        if (clauses.length > 30) throw new AppError('NQL supports at most 30 conditions', 400);
        return {
            where: {
                AND: clauses.map((clause) => {
                    const alternatives = splitOutside(clause, /^\s+OR\s+/i);
                    return alternatives.length > 1
                        ? { OR: alternatives.map((alternative) => this.parseClause(alternative, actorId)) }
                        : this.parseClause(clause, actorId);
                }),
            },
            orderBy,
        };
    }

    private parseClause(clause: string, actorId: string): Prisma.WorkItemWhereInput {
        const customMatch = clause.match(/^custom\.([A-Z0-9_]+)\s*(=|!=|~)\s*(.+)$/i);
        if (customMatch) {
            const [, key, operator, rawValue] = customMatch;
            const value = this.resolveValue(rawValue, actorId);
            const equals = { customFields: { path: [key.toUpperCase()], equals: value as Prisma.InputJsonValue } };
            return operator === '!=' ? { NOT: equals } : operator === '~'
                ? { customFields: { path: [key.toUpperCase()], string_contains: String(value) } }
                : equals;
        }

        const emptyMatch = clause.match(/^([a-zA-Z][\w]*)\s+IS\s+(NOT\s+)?EMPTY$/i);
        if (emptyMatch) {
            const field = this.resolveField(emptyMatch[1]);
            const empty = { OR: [{ [field]: null }, ...(field === 'title' ? [{ [field]: '' }] : [])] };
            return emptyMatch[2] ? { NOT: empty } : empty;
        }

        const inMatch = clause.match(/^([a-zA-Z][\w]*)\s+(NOT\s+)?IN\s*\((.*)\)$/i);
        if (inMatch) {
            const field = this.resolveField(inMatch[1]);
            const values = splitOutside(inMatch[3], /^\s*,\s*/).map((value) => this.coerce(field, this.resolveValue(value, actorId)));
            if (!values.length || values.length > 100) throw new AppError('IN requires 1 to 100 values', 400);
            const condition = { [field]: { in: values } };
            return inMatch[2] ? { NOT: condition } : condition;
        }

        const match = clause.match(/^([a-zA-Z][\w]*)\s*(>=|<=|!=|=|>|<|~)\s*(.+)$/);
        if (!match) throw new AppError(`Invalid NQL condition: ${clause}`, 400);
        const field = this.resolveField(match[1]);
        const operator = match[2];
        const value = this.coerce(field, this.resolveValue(match[3], actorId));
        if (operator === '~') {
            if (field === '__text') {
                return { OR: ['title', 'description', 'key'].map((textField) => ({ [textField]: { contains: String(value), mode: 'insensitive' } })) };
            }
            if (!['title', 'key'].includes(field)) throw new AppError(`~ is not supported for ${match[1]}`, 400);
            return { [field]: { contains: String(value), mode: 'insensitive' } };
        }
        const prismaOperator: Record<string, string> = { '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte' };
        if (prismaOperator[operator]) return { [field]: { [prismaOperator[operator]]: value } };
        if (operator === '!=') return { NOT: { [field]: value } };
        return { [field]: value };
    }

    private parseOrderBy(raw: string): Prisma.WorkItemOrderByWithRelationInput[] {
        const entries = raw.split(',').map((entry) => entry.trim()).filter(Boolean);
        if (!entries.length || entries.length > 3) throw new AppError('ORDER BY supports 1 to 3 fields', 400);
        return entries.map((entry) => {
            const match = entry.match(/^([a-zA-Z][\w]*)(?:\s+(ASC|DESC))?$/i);
            if (!match) throw new AppError(`Invalid ORDER BY: ${entry}`, 400);
            const field = this.resolveField(match[1]);
            if (!SORTABLE.has(field)) throw new AppError(`${match[1]} cannot be sorted`, 400);
            return { [field]: (match[2]?.toLowerCase() || 'asc') as SortDirection };
        });
    }

    private resolveField(input: string) {
        const field = FIELD_MAP[input.toLowerCase()];
        if (!field) throw new AppError(`Unknown NQL field: ${input}`, 400);
        return field;
    }

    private resolveValue(input: string, actorId: string): string | boolean | null {
        const value = unquote(input);
        if (/^currentUser\(\)$/i.test(value)) return actorId;
        if (/^(EMPTY|null)$/i.test(value)) return null;
        if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
        return value;
    }

    private coerce(field: string, value: string | boolean | null) {
        if (value === null || typeof value === 'boolean') return value;
        if (ENUM_FIELDS.has(field)) return value.toUpperCase();
        if (NUMBER_FIELDS.has(field)) {
            const number = Number(value);
            if (!Number.isFinite(number)) throw new AppError(`${field} requires a number`, 400);
            return number;
        }
        if (DATE_FIELDS.has(field)) {
            const relative = value.match(/^-(\d+)([dhw])$/i);
            let date: Date;
            if (/^now\(\)$/i.test(value)) date = new Date();
            else if (relative) {
                const multiplier = relative[2].toLowerCase() === 'h' ? 60 * 60 * 1000 : relative[2].toLowerCase() === 'w' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
                date = new Date(Date.now() - Number(relative[1]) * multiplier);
            } else date = new Date(value);
            if (Number.isNaN(date.getTime())) throw new AppError(`${field} requires an ISO date`, 400);
            return date;
        }
        return value;
    }
}

export const nqlService = new NqlService();
