export const permissionCompatibilityMap: Record<string, string[]> = {
    'request.read': ['business-request:read'],
    'request.create': ['business-request:write'],
    'request.update': ['business-request:write'],
    'request.approve': ['business-request:approve'],
    'analysis.run': ['business-request:analyze'],

    'wiki.read': ['wiki:read'],
    'wiki.create': ['wiki:write'],
    'wiki.update': ['wiki:write'],
    'wiki.manage': ['wiki:manage'],

    'backlog.read': ['story:read', 'work-item:read'],
    'backlog.create': ['story:write', 'work-item:create'],
    'backlog.update': ['story:write', 'work-item:update'],
    'backlog.assign': ['work-item:assign'],
    'backlog.prioritize': ['work-item:prioritize'],
    'backlog.manage-flow': ['work-item:move', 'story:write'],

    'sprint.read': ['sprint:read'],
    'sprint.create': ['sprint:write'],
    'sprint.update': ['sprint:write'],
    'sprint.manage': ['sprint:manage', 'sprint:write'],
    'board.read': ['board:read'],
    'board.move': ['story:write', 'board:item:move'],
    'board.manage': ['board:manage'],

    'test-scope.read': ['test:read', 'test-case:read'],
    'test-scope.create': ['test:write', 'test-case:write'],
    'test-scope.update': ['test:write', 'test-case:write'],
    'test-case.approve': ['test:approve', 'testcases:approve'],
    'quality.approve': ['test:approve', 'testcases:approve', 'testcases:request-revision'],

    'run.read': ['run:read', 'test:read'],
    'run.create': ['run:write'],
    'run.update': ['run:write'],
    'run.manage': ['run:manage', 'testruns:delete'],
    'execution.manual': ['test:execute'],
    'execution.automation': ['test:execute', 'run-automation:execute'],
    'conflict.resolve': ['test:approve'],
    'release.create': [],
    'release.read': ['dashboard:management', 'dashboard:performance'],
    'release.decide-scope': ['request.approve'],
    'release.decide-delivery': ['run.manage', 'project.manage'],
    'release.decide-quality': ['quality.approve'],
    'release.decide-risk': ['project.manage'],
    'release.finalize': ['project.manage', 'quality.approve'],

    'integration.read': ['integration:read'],
    'integration.manage': ['integration:write'],
    'attachment.read': ['attachment:read'],
    'attachment.write': ['attachment:write'],
    'attachment.delete': ['attachment:delete'],
};

const legacyRolePermissionMap: Record<string, string[]> = {
    TEAM_LEADER: [
        'project.read',
        'project.update',
        'project.manage',
        'membership.read',
        'membership.manage',
        'request.read',
        'request.create',
        'request.update',
        'request.approve',
        'analysis.run',
        'backlog.read',
        'backlog.create',
        'backlog.update',
        'backlog.assign',
        'backlog.prioritize',
        'backlog.manage-flow',
        'sprint.read',
        'sprint.create',
        'sprint.update',
        'sprint.manage',
        'board.read',
        'board.move',
        'board.manage',
        'run.read',
        'run.create',
        'run.update',
        'run.manage',
        'release.create',
        'release.read',
        'release.decide-scope',
        'release.decide-delivery',
        'wiki.read',
        'wiki.create',
        'wiki.update',
        'integration.read',
        'integration.manage',
        'dashboard:management',
        'dashboard:performance',
    ],
    TESTER: [
        'project.read',
        'request.read',
        'backlog.read',
        'backlog.update',
        'board.read',
        'board.move',
        'wiki.read',
        'wiki.update',
        'test-scope.read',
        'test-scope.create',
        'test-scope.update',
        'run.read',
        'run.create',
        'run.update',
        'execution.manual',
        'execution.automation',
        'release.read',
        'attachment.read',
        'attachment.write',
    ],
};

const reverseCompatibilityMap = Object.entries(permissionCompatibilityMap).reduce<Record<string, string[]>>((acc, [canonical, aliases]) => {
    for (const alias of aliases) {
        acc[alias] = [...(acc[alias] || []), canonical];
    }
    return acc;
}, {});

export const expandPermissionKeys = (keys: string[]): string[] => {
    const expanded = new Set<string>();

    for (const key of keys) {
        expanded.add(key);

        const directAliases = permissionCompatibilityMap[key] || [];
        for (const alias of directAliases) {
            expanded.add(alias);
        }

        const canonicalKeys = reverseCompatibilityMap[key] || [];
        for (const canonical of canonicalKeys) {
            expanded.add(canonical);
            const aliases = permissionCompatibilityMap[canonical] || [];
            for (const alias of aliases) {
                expanded.add(alias);
            }
        }
    }

    return [...expanded];
};

export const hasPermission = (keys: string[], required: string): boolean => {
    const expanded = expandPermissionKeys(keys);
    return expanded.includes(required);
};

export const getLegacyProjectPermissions = (role?: string | null): string[] => {
    if (!role) {
        return [];
    }

    return expandPermissionKeys(legacyRolePermissionMap[role] || []);
};
