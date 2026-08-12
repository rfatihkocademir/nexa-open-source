export type Role = 'ADMIN' | 'TEAM_LEADER' | 'TESTER' | 'PRODUCT_OWNER' | 'SCRUM_MASTER' | 'DEVELOPER' | 'ANALYST';

export type PolicyKey =
    | 'users:read'
    | 'users:create'
    | 'users:update'
    | 'users:delete'
    | 'projects:create'
    | 'projects:update'
    | 'projects:delete'
    | 'projects:archive'
    | 'projects:unarchive'
    | 'projects:members:add'
    | 'projects:members:remove'
    | 'projects:warnings'
    | 'milestones:create'
    | 'milestones:update'
    | 'milestones:delete'
    | 'testcases:approve'
    | 'testcases:request-revision'
    | 'testruns:delete'
    | 'dashboard:management'
    | 'dashboard:performance';

export const accessPolicy: Record<PolicyKey, Role[]> = {
    'users:read': ['ADMIN', 'TEAM_LEADER', 'SCRUM_MASTER', 'PRODUCT_OWNER', 'ANALYST'],
    'users:create': ['ADMIN', 'TEAM_LEADER'],
    'users:update': ['ADMIN', 'TEAM_LEADER'],
    'users:delete': ['ADMIN'],

    'projects:create': ['ADMIN', 'TEAM_LEADER'],
    'projects:update': ['ADMIN', 'TEAM_LEADER', 'PRODUCT_OWNER', 'SCRUM_MASTER'],
    'projects:delete': ['ADMIN', 'TEAM_LEADER'],
    'projects:archive': ['ADMIN', 'TEAM_LEADER'],
    'projects:unarchive': ['ADMIN', 'TEAM_LEADER'],
    'projects:members:add': ['ADMIN', 'TEAM_LEADER', 'SCRUM_MASTER'],
    'projects:members:remove': ['ADMIN', 'TEAM_LEADER', 'SCRUM_MASTER'],
    'projects:warnings': ['ADMIN', 'TEAM_LEADER'],

    'milestones:create': ['ADMIN', 'TEAM_LEADER', 'PRODUCT_OWNER', 'SCRUM_MASTER'],
    'milestones:update': ['ADMIN', 'TEAM_LEADER', 'PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPER'],
    'milestones:delete': ['ADMIN', 'TEAM_LEADER', 'PRODUCT_OWNER'],

    'testcases:approve': ['ADMIN', 'TEAM_LEADER', 'SCRUM_MASTER', 'PRODUCT_OWNER'],
    'testcases:request-revision': ['ADMIN', 'TEAM_LEADER', 'SCRUM_MASTER', 'TESTER', 'PRODUCT_OWNER'],

    'testruns:delete': ['ADMIN', 'TEAM_LEADER'],

    'dashboard:management': ['ADMIN', 'TEAM_LEADER', 'PRODUCT_OWNER', 'SCRUM_MASTER', 'ANALYST', 'DEVELOPER', 'TESTER'],
    'dashboard:performance': ['ADMIN', 'TEAM_LEADER', 'PRODUCT_OWNER', 'SCRUM_MASTER', 'ANALYST'],
};
