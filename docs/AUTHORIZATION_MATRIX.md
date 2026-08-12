# Authorization Matrix

Date: 2026-08-10
Scope: `backend/src/app.ts`, `backend/src/routes/**`, and the controller/service authorization paths they call.

## Legend
- `A` = `ADMIN`
- `TL` = `TEAM_LEADER`
- `T` = `TESTER`
- `JWT` = authenticated via `protect` or `protectAssetAccess`
- `projectRoute(X)` / `protectedProjectRoute(X)` = `ADMIN` bypass; non-admin must be a `ProjectMember` and hold project permission `X`
- `authorize(X)` / `restrictTo(...)` = global role/policy gate
- `Member-only` = only `ProjectAccess.check*` is used; no granular permission key is enforced
- `Self` = endpoint is effectively bound to the caller's own user/notification/worklog record
- `Weak` = auth exists but is not bound tightly enough to the real target resource

## Model Summary
- Global role/policy model lives in `backend/src/utils/accessPolicy.ts`.
- Project-scoped permission model lives in `backend/src/utils/permissionCatalog.ts` and `backend/src/middlewares/rbac.middleware.ts`.
- Custom `AccessRole` records can override legacy defaults. The role lists below are only the built-in defaults from source code.
- Legacy permission expansion has side effects. Example: `release.create` is implied by `run.create`, so legacy `TESTER` can create release candidates by default.

## Key Findings
- The previously identified critical/high object-level authorization findings are now fixed: environments, GitHub webhook signatures, release eligibility project binding, project-element deletion, milestone listing, cross-project test-case tags, release decision permissions, AI generation, and automation dry-run/cleanup all resolve and validate project scope before executing.
- Remaining medium risk: some modules intentionally use coarse project membership instead of a granular permission key (for example parts of suites, import, test results and storage). This does not cross tenant boundaries, but should be migrated to the permission catalog before introducing custom least-privilege roles for those modules.
- Operational risk: AI routes correctly return `503` when every configured provider is unavailable. Production must supply a valid provider/model; the deployment now fails early for missing Ollama models instead of allowing a partially usable backend to become healthy.

## Endpoint Matrix

### Public And Infra
- `GET /test` — Public. No authorization. Diagnostic route.
- `GET /health` — Public. No authorization. Health probe.
- `GET /public/*` — Public static file access.
- `GET /api/v1/monitor/snapshot` — No JWT. Localhost-only unless `MONITOR_ALLOW_REMOTE=true`. Safe by default; becomes public-remote if that env flag is enabled.
- `GET /api/v1/monitor/stream` — Same as `/monitor/snapshot`.
- `POST /api/v1/webhooks/git/github` — Public webhook. Requires `projectId`, configured `GITHUB_WEBHOOK_SECRET`, raw-body HMAC-SHA256 verification and `x-github-event`.
- `POST /api/v1/auth/register` — Public. Open self-registration.
- `POST /api/v1/auth/login` — Public.

### Users
- `GET /api/v1/users/me` — JWT. Self.
- `PATCH /api/v1/users/me` — JWT. Self.
- `GET /api/v1/users/:id` — JWT. `authorize(users:read)`. Legacy default: `A/TL`.
- `GET /api/v1/users` — JWT. `authorize(users:read)`. Legacy default: `A/TL`.
- `POST /api/v1/users` — JWT. `authorize(users:create)`. Legacy default: `A/TL`.
- `PATCH /api/v1/users/:id` — JWT. `authorize(users:update)`. Legacy default: `A/TL`.
- `DELETE /api/v1/users/:id` — JWT. `authorize(users:delete)`. Legacy default: `A` only.

### Projects
- `GET /api/v1/projects` — JWT. Effective access: `ADMIN` sees all; non-admins only see projects where `ProjectMember` exists. Strong.
- `POST /api/v1/projects` — JWT. `authorize(projects:create)`. Legacy default: `A/TL`.
- `POST /api/v1/projects/ai/questions` — JWT. `authorize(projects:create)`. Legacy default: `A/TL`.
- `POST /api/v1/projects/ai/scope` — JWT. `authorize(projects:create)`. Legacy default: `A/TL`.
- `POST /api/v1/projects/ai/wiki` — JWT. `authorize(projects:create)`. Legacy default: `A/TL`.
- `POST /api/v1/projects/ai/documentation-suite` — JWT. `authorize(projects:create)`. Legacy default: `A/TL`.
- `GET /api/v1/projects/warnings` — JWT. `authorize(projects:warnings)`. Legacy default: `A` only.
- `GET /api/v1/projects/:id` — JWT. Effective access: `ADMIN` or project member. Strong.
- `PATCH /api/v1/projects/:id` — JWT. `projectRoute(project.update)`. Legacy default: `A/TL`.
- `DELETE /api/v1/projects/:id` — JWT. `projectRoute(project.manage)`. Legacy default: `A/TL`.
- `POST /api/v1/projects/:id/members` — JWT. `projectRoute(membership.manage)`. Legacy default: `A/TL`.
- `DELETE /api/v1/projects/:id/members/:userId` — JWT. `projectRoute(membership.manage)`. Legacy default: `A/TL`.
- `PATCH /api/v1/projects/:id/archive` — JWT. `projectRoute(project.manage)`. Legacy default: `A/TL`.
- `PATCH /api/v1/projects/:id/unarchive` — JWT. `projectRoute(project.manage)`. Legacy default: `A/TL`.
- `GET /api/v1/projects/:id/export-cases` — JWT. `projectRoute(test-scope.read)`. Legacy default: `A/T`. `TL` does not have this by default.
- `GET /api/v1/projects/:id/elements` — JWT. `projectRoute(project.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/projects/:id/elements` — JWT. `projectRoute(project.update)`. Legacy default: `A/TL`.
- `DELETE /api/v1/projects/:id/elements/:elementId` — JWT. `projectRoute(project.update)` and a scoped `{id, projectId}` deletion; cross-project element IDs return not found.

### Business Requests
- `GET /api/v1/business-requests` and `GET /api/v1/projects/:projectId/business-requests` — JWT. `projectRoute(request.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/business-requests` and `POST /api/v1/projects/:projectId/business-requests` — JWT. `projectRoute(request.create)`. Legacy default: `A/TL`.
- `GET /api/v1/business-requests/:id` and `GET /api/v1/projects/:projectId/business-requests/:id` — JWT. `projectRoute(request.read)`. Legacy default: `A/TL/T`.
- `GET /api/v1/business-requests/:id/guidance` and `GET /api/v1/projects/:projectId/business-requests/:id/guidance` — JWT. `projectRoute(request.read)`. Legacy default: `A/TL/T`.
- `PATCH /api/v1/business-requests/:id` and `PATCH /api/v1/projects/:projectId/business-requests/:id` — JWT. `projectRoute(request.update)`. Legacy default: `A/TL`.
- `POST /api/v1/business-requests/:id/analyze` and `POST /api/v1/projects/:projectId/business-requests/:id/analyze` — JWT. `projectRoute(analysis.run)`. Legacy default: `A/TL`.
- `POST /api/v1/business-requests/:id/approve` and `POST /api/v1/projects/:projectId/business-requests/:id/approve` — JWT. `projectRoute(request.approve)`. Legacy default: `A/TL`.
- `DELETE /api/v1/business-requests/:id` and `DELETE /api/v1/projects/:projectId/business-requests/:id` — JWT. `projectRoute(project.manage)`. Legacy default: `A/TL`.

### Requirements
- `GET /api/v1/requirements` — JWT. `protectedProjectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/requirements` — JWT. `protectedProjectRoute(backlog.create)`. Legacy default: `A/TL`.
- `GET /api/v1/requirements/:id` — JWT. `protectedProjectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `PATCH /api/v1/requirements/:id/status` — JWT. `protectedProjectRoute(backlog.update)`. Legacy default: `A/TL/T`.

### Work Items
- `POST /api/v1/work-items` — JWT. `projectRoute(backlog.create)`. Legacy default: `A/TL`.
- `GET /api/v1/work-items` — JWT. `projectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `GET /api/v1/work-items/:id` — JWT. `projectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `PUT /api/v1/work-items/:id` — JWT. `projectRoute(backlog.update)`. Legacy default: `A/TL/T`.
- `PATCH /api/v1/work-items/:id` — JWT. `projectRoute(backlog.update)`. Legacy default: `A/TL/T`.
- `DELETE /api/v1/work-items/:id` — JWT. `projectRoute(project.manage)`. Legacy default: `A/TL`.

### Work Item Aliases
- `GET /api/v1/epics` — JWT. `protectedProjectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/epics` — JWT. `protectedProjectRoute(backlog.create)`. Legacy default: `A/TL`.
- `GET /api/v1/epics/:id` — JWT. `protectedProjectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `PUT /api/v1/epics/:id` — JWT. `protectedProjectRoute(backlog.update)`. Legacy default: `A/TL/T`.
- `PATCH /api/v1/epics/:id` — JWT. `protectedProjectRoute(backlog.update)`. Legacy default: `A/TL/T`.
- `DELETE /api/v1/epics/:id` — JWT. `protectedProjectRoute(project.manage)`. Legacy default: `A/TL`.
- `GET /api/v1/stories` — JWT. `protectedProjectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/stories` — JWT. `protectedProjectRoute(backlog.create)`. Legacy default: `A/TL`.
- `GET /api/v1/stories/:id` — JWT. `protectedProjectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `PUT /api/v1/stories/:id` — JWT. `protectedProjectRoute(backlog.update)`. Legacy default: `A/TL/T`.
- `PATCH /api/v1/stories/:id` — JWT. `protectedProjectRoute(backlog.update)`. Legacy default: `A/TL/T`.
- `DELETE /api/v1/stories/:id` — JWT. `protectedProjectRoute(project.manage)`. Legacy default: `A/TL`.
- `GET /api/v1/tasks` — JWT. `protectedProjectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/tasks` — JWT. `protectedProjectRoute(backlog.create)`. Legacy default: `A/TL`.
- `GET /api/v1/tasks/:id` — JWT. `protectedProjectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `PUT /api/v1/tasks/:id` — JWT. `protectedProjectRoute(backlog.update)`. Legacy default: `A/TL/T`.
- `PATCH /api/v1/tasks/:id` — JWT. `protectedProjectRoute(backlog.update)`. Legacy default: `A/TL/T`.
- `DELETE /api/v1/tasks/:id` — JWT. `protectedProjectRoute(project.manage)`. Legacy default: `A/TL`.
- `GET /api/v1/bugs` — JWT. `protectedProjectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/bugs` — JWT. `protectedProjectRoute(backlog.create)`. Legacy default: `A/TL`.
- `GET /api/v1/bugs/:id` — JWT. `protectedProjectRoute(backlog.read)`. Legacy default: `A/TL/T`.
- `PUT /api/v1/bugs/:id` — JWT. `protectedProjectRoute(backlog.update)`. Legacy default: `A/TL/T`.
- `PATCH /api/v1/bugs/:id` — JWT. `protectedProjectRoute(backlog.update)`. Legacy default: `A/TL/T`.
- `DELETE /api/v1/bugs/:id` — JWT. `protectedProjectRoute(project.manage)`. Legacy default: `A/TL`.

### Comments
- `POST /api/v1/comments` — JWT. `projectRoute(backlog.update)`. Legacy default: `A/TL/T`.
- `GET /api/v1/comments/workitem/:workItemId` — JWT. `projectRoute(backlog.read)`. Legacy default: `A/TL/T`.

### Board Columns And Agile
- `POST /api/v1/board-columns` — JWT. `projectRoute(board.manage)`. Legacy default: `A/TL`.
- `GET /api/v1/board-columns/project/:projectId` — JWT. `projectRoute(board.read)`. Legacy default: `A/TL/T`.
- `PUT /api/v1/board-columns/:id` — JWT. `projectRoute(board.manage)`. Legacy default: `A/TL`.
- `DELETE /api/v1/board-columns/:id` — JWT. `projectRoute(board.manage)`. Legacy default: `A/TL`.
- `POST /api/v1/board-columns/reorder` — JWT. `projectRoute(board.manage)`. Legacy default: `A/TL`.
- `GET /api/v1/projects/:projectId/agile/board` — JWT. `protectedProjectRoute(board.read)`. Legacy default: `A/TL/T`.
- `PUT /api/v1/agile/move/:type/:id` — JWT. `protectedProjectRoute(board.move)`. Legacy default: `A/TL/T`.

### Analytics
- `GET /api/v1/projects/:projectId/analytics/traceability` — JWT. `protectedProjectRoute(project.read)`. Legacy default: `A/TL/T`.

### Milestones
- `GET /api/v1/milestones` — JWT. Requires `projectId` and `projectRoute(project.read)`; projectless cross-project listing is rejected.
- `POST /api/v1/milestones` — JWT. `authorize(milestones:create)` plus project membership on `body.projectId`. Legacy default: `A/TL`.
- `GET /api/v1/milestones/:id` — JWT. Effective access: `ADMIN` or project member of that milestone's project. Strong.
- `PATCH /api/v1/milestones/:id` — JWT. `authorize(milestones:update)` plus project membership. Legacy default: `A/TL`.
- `DELETE /api/v1/milestones/:id` — JWT. `authorize(milestones:delete)` plus project membership. Legacy default: `A/TL`.

### Test Suites
- `GET /api/v1/suites` — JWT. `Member-only` via query `projectId` and `ProjectAccess.check`. Coarse; no `test-scope.read` permission.
- `POST /api/v1/suites` — JWT. `Member-only` via `body.projectId`. Coarse; no `test-scope.create` permission.
- `GET /api/v1/suites/:id` — JWT. `Member-only` via suite project. Coarse.
- `PATCH /api/v1/suites/:id` — JWT. `Member-only` via suite project. Coarse.
- `DELETE /api/v1/suites/:id` — JWT. `Member-only` via suite project. Coarse.
- `POST /api/v1/suites/:id/restore` — JWT. `ADMIN` only in service, then project membership check. Strong.

### Test Cases
- `GET /api/v1/cases/search` — JWT. `projectRoute(test-scope.read)`. Legacy default: `A/T`.
- `GET /api/v1/cases` — JWT. `projectRoute(test-scope.read)` resolved from `suiteId`. Legacy default: `A/T`.
- `POST /api/v1/cases` — JWT. `projectRoute(test-scope.create)` resolved from `suiteId`. Legacy default: `A/T`.
- `GET /api/v1/cases/:id` — JWT. `projectRoute(test-scope.read)`. Legacy default: `A/T`.
- `PATCH /api/v1/cases/:id` — JWT. `projectRoute(test-scope.update)`. Legacy default: `A/T`.
- `DELETE /api/v1/cases/:id` — JWT. `projectRoute(quality.approve)`. Legacy default: `A/TL`.
- `POST /api/v1/cases/:id/restore` — JWT. `projectRoute(quality.approve)`. Legacy default: `A/TL`.
- `POST /api/v1/cases/:id/revert/:version` — JWT. `projectRoute(test-scope.update)`. Legacy default: `A/T`.
- `GET /api/v1/cases/:id/history` — JWT. `projectRoute(test-scope.read)`. Legacy default: `A/T`.
- `PATCH /api/v1/cases/:id/approve` — JWT. `projectRoute(test-case.approve)`. Legacy default: `A` only unless a custom project role grants this key.
- `PATCH /api/v1/cases/:id/request-revision` — JWT. `projectRoute(quality.approve)`. Legacy default: `A/TL`.
- `POST /api/v1/cases/bulk/delete` — JWT. `projectRoute(quality.approve)`. Legacy default: `A/TL`.
- `POST /api/v1/cases/bulk/status` — JWT. `projectRoute(test-scope.update)`. Legacy default: `A/T`.
- `PATCH /api/v1/cases/:id/move` — JWT. `projectRoute(test-scope.update)`. Legacy default: `A/T`.
- `POST /api/v1/cases/:id/tags` — JWT. `projectRoute(test-scope.update)` plus same-project validation for every tag.
- `DELETE /api/v1/cases/:id/tags/:tagId` — JWT. `projectRoute(test-scope.update)` plus same-project tag validation.

### Test Runs
- `GET /api/v1/runs` — JWT. `projectRoute(run.read)` using query `projectId`. Legacy default: `A/TL/T`. Note: route-level auth makes projectless/global listing effectively unreachable.
- `POST /api/v1/runs` — JWT. `projectRoute(run.create)`. Legacy default: `A/TL/T`.
- `GET /api/v1/runs/:id` — JWT. `projectRoute(run.read)` via run ID resolver. Legacy default: `A/TL/T`. Note: global runs with `projectId=null` will fail project resolution.
- `PATCH /api/v1/runs/:id` — JWT. `projectRoute(run.update)`. Legacy default: `A/TL/T`.
- `DELETE /api/v1/runs/:id` — JWT. `projectRoute(run.manage)`. Legacy default: `A/TL`.
- `GET /api/v1/runs/:id/conflicts` — JWT. `projectRoute(run.read)`. Legacy default: `A/TL/T`.
- `GET /api/v1/runs/:id/report` — JWT. `projectRoute(run.read)`. Legacy default: `A/TL/T`.
- `GET /api/v1/runs/:id/comparison-report` — JWT. `projectRoute(run.read)`. Legacy default: `A/TL/T`.
- `GET /api/v1/runs/:id/export-results` — JWT. `projectRoute(run.read)`. Legacy default: `A/TL/T`.
- `GET /api/v1/runs/:id/export-comparison` — JWT. `projectRoute(run.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/runs/:id/execute-automation` — JWT. `projectRoute(execution.automation)`. Legacy default: `A/T`. `TL` does not have this by default.
- `POST /api/v1/runs/:id/notify-completion` — JWT. `projectRoute(run.manage)`. Legacy default: `A/TL`.
- `POST /api/v1/runs/:id/items` — JWT. `projectRoute(run.update)`. Legacy default: `A/TL/T`.
- `POST /api/v1/runs/items/:itemId/trigger` — JWT. `projectRoute(execution.automation)`. Legacy default: `A/T`.
- `DELETE /api/v1/runs/items/:itemId` — JWT. `projectRoute(run.manage)`. Legacy default: `A/TL`.
- `POST /api/v1/runs/quick-run` — JWT. `projectRoute(run.create)`. Legacy default: `A/TL/T`.

### Test Results
- `POST /api/v1/items/:runItemId/results` — JWT. `Member-only` via `ProjectAccess.checkByRunItem`. Coarse; no explicit execution permission.
- `PATCH /api/v1/items/:runItemId/manual-result` — JWT. Same as above.
- `PATCH /api/v1/items/:runItemId/automation-result` — JWT. Same as above.

### Dashboard
- `GET /api/v1/dashboard/stats` — JWT. `Member-only` via query `projectId` and `ProjectAccess.check`. Coarse; no dashboard permission.
- `GET /api/v1/dashboard/recent-activities` — JWT. Effective access: caller sees only projects they belong to; `ADMIN` sees all.
- `GET /api/v1/dashboard/search` — JWT. Effective access: caller searches only accessible projects; `ADMIN` searches all.
- `GET /api/v1/dashboard/management` — JWT. `authorize(dashboard:management)` plus project membership in service. Legacy default: `A/TL`.
- `GET /api/v1/dashboard/performance` — JWT. `authorize(dashboard:performance)` plus project membership in service. Legacy default: `A/TL`.

### Import
- `POST /api/v1/import/excel` — JWT. `Member-only` via suite/project membership. Coarse; no `test-scope.create` check. Also creates default suite when only `projectId` is supplied.

### Storage
- `GET /api/v1/storage/attachments/:id` — JWT or token query param via `protectAssetAccess`. Effective access: project membership on the owning resource, or uploader for unattached files. Strong.
- `POST /api/v1/storage/upload` — JWT. Effective access: target resource access is checked if a target is provided. Weak-ish for storage abuse because unattached uploads are also allowed.
- `DELETE /api/v1/storage/attachments/:id` — JWT. Effective access: project membership on owning resource, or uploader for unattached files. Strong.
- `GET /api/v1/storage/work-items/:workItemId/attachments` — JWT. `Member-only` via `ProjectAccess.checkByWorkItem`.
- `GET /api/v1/storage/comments/:commentId/attachments` — JWT. `Member-only` via `ProjectAccess.checkByComment`.
- `GET /api/v1/storage/test-results/:testResultId/attachments` — JWT. `Member-only` via `ProjectAccess.checkByTestResult`.
- `GET /api/v1/storage/test-cases/:testCaseId/attachments` — JWT. `Member-only` via `ProjectAccess.checkByTestCase`.
- `GET /api/v1/storage/wiki-pages/:wikiPageId/attachments` — JWT. `Member-only` via `ProjectAccess.checkByWikiPage`.

### Tags
- `POST /api/v1/tags` — JWT. `projectRoute(project.update)`. Legacy default: `A/TL`.
- `GET /api/v1/tags` — JWT. `projectRoute(project.read)`. Legacy default: `A/TL/T`.
- `PATCH /api/v1/tags/:id` — JWT. `projectRoute(project.update)`. Legacy default: `A/TL`.
- `DELETE /api/v1/tags/:id` — JWT. `projectRoute(project.update)`. Legacy default: `A/TL`.

### Automation Steps
- `POST /api/v1/automation/steps` — JWT. `Member-only` via `body.projectId`. Coarse.
- `POST /api/v1/automation/steps/suggest` — JWT only. No project context. Any authenticated user can call it.
- `GET /api/v1/automation/steps` — JWT. `Member-only` via query `projectId`.
- `GET /api/v1/automation/steps/:id` — JWT. `Member-only` via step project.
- `PATCH /api/v1/automation/steps/:id` — JWT. `Member-only` via step project.
- `DELETE /api/v1/automation/steps/:id` — JWT. `Member-only` via step project.

### Automation Scenarios
- `POST /api/v1/automation/scenarios` — JWT. `Member-only` via the target test case's project.
- `POST /api/v1/automation/scenarios/dry-run` — JWT + project authorization. Executes generated Playwright automation only for a project the actor can access.
- `POST /api/v1/automation/scenarios/cleanup-video` — JWT + `execution.automation` project authorization; only accepts the validated dry-run video naming contract.
- `GET /api/v1/automation/scenarios/:id` — JWT. `Member-only` via scenario test case project.
- `GET /api/v1/automation/scenarios/testcase/:testCaseId` — JWT. `Member-only` via test case project.
- `PATCH /api/v1/automation/scenarios/:id` — JWT. `Member-only` via scenario test case project.
- `DELETE /api/v1/automation/scenarios/:id` — JWT. `Member-only` via scenario test case project.

### Scenario Steps
- `POST /api/v1/automation/scenario-steps` — JWT. `Member-only` via resolved scenario/test case project.
- `GET /api/v1/automation/scenario-steps/scenario/:scenarioId` — JWT. `Member-only` via resolved scenario/test case project.
- `DELETE /api/v1/automation/scenario-steps/:id` — JWT. `Member-only` via resolved scenario/test case project.
- `PATCH /api/v1/automation/scenario-steps/reorder` — JWT. `Member-only` via resolved scenario/test case project.

### AI
- `POST /api/v1/ai/analyze` — JWT. `projectRoute(analysis.run)`. Legacy default: `A/TL`.
- `POST /api/v1/ai/generate-stories` — JWT + `analysis.run` project authorization; `projectId` is required and validated.
- `POST /api/v1/ai/generate-steps` — JWT + `project.read` project authorization; `projectId` is required and validated.
- `POST /api/v1/ai/generate-tests-from-story` — JWT. `projectRoute(analysis.run)`. Legacy default: `A/TL`.
- `POST /api/v1/ai/test-results/:testResultId/analyze-failure` — JWT. `projectRoute(analysis.run)`. Legacy default: `A/TL`.
- `POST /api/v1/ai/:projectId/batch-create` — JWT. `projectRoute(backlog.create)`. Legacy default: `A/TL`.
- `POST /api/v1/ai/:projectId/chat` — JWT. `projectRoute(project.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/ai/:projectId/sync-knowledge` — JWT. `projectRoute(project.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/ai/:projectId/extract-elements` — JWT. `projectRoute(project.update)`. Legacy default: `A/TL`.

### Notifications
- `GET /api/v1/notifications` — JWT. Self.
- `PATCH /api/v1/notifications/read-all` — JWT. Self.
- `PATCH /api/v1/notifications/:id/read` — JWT. Self.
- `DELETE /api/v1/notifications/:id` — JWT. Self.

### Sprints
- `POST /api/v1/sprints` — JWT. `Member-only` via `body.projectId`. Coarse; no `sprint.create` permission.
- `GET /api/v1/sprints` — JWT. `Member-only` via query `projectId`. Coarse; no `sprint.read` permission.
- `GET /api/v1/sprints/:id` — JWT. `Member-only` via sprint project.
- `POST /api/v1/sprints/:id/start` — JWT. `Member-only` via sprint project.
- `POST /api/v1/sprints/:id/complete` — JWT. `Member-only` via sprint project.
- `PATCH /api/v1/sprints/:id` — JWT. `Member-only` via sprint project.
- `DELETE /api/v1/sprints/:id` — JWT. `Member-only` via sprint project.

### Worklogs
- `POST /api/v1/worklogs` — JWT. Self-created record; if a project or work item is referenced, project membership is checked. Strong enough for personal worklogs.
- `GET /api/v1/worklogs` — JWT. Effective access: `ADMIN` can query broadly; non-admin without `projectId` is forced to own `userId`. If `projectId` is supplied, membership is checked.
- `PATCH /api/v1/worklogs/:id` — JWT. Self or `ADMIN`.
- `DELETE /api/v1/worklogs/:id` — JWT. Self or `ADMIN`.

### Integrations
- `GET /api/v1/projects/:projectId/integrations` — JWT. `Member-only` via project membership. Coarse; cataloged `integration.read` permission is unused.
- `POST /api/v1/projects/:projectId/integrations` — JWT. `Member-only` via project membership. Coarse; cataloged `integration.manage` permission is unused.
- `PUT /api/v1/projects/:projectId/integrations/:id` — JWT. `Member-only` via project membership and `{ id, projectId }` lookup.
- `DELETE /api/v1/projects/:projectId/integrations/:id` — JWT. `Member-only` via project membership and `{ id, projectId }` lookup.

### Environments
- `GET /api/v1/environments/project/:projectId` — JWT + `project.read` project authorization.
- `POST /api/v1/environments/project/:projectId` — JWT + `project.update` project authorization.
- `POST /api/v1/environments/project/:projectId/defaults` — JWT + `project.update` project authorization.
- `PATCH /api/v1/environments/:id` — JWT + environment-to-project resolution + `project.update` authorization.
- `DELETE /api/v1/environments/:id` — JWT + environment-to-project resolution + `project.update` authorization; archive semantics are preserved.

### Prompts
- `GET /api/v1/prompts` — JWT. Any authenticated user.
- `GET /api/v1/prompts/:slug` — JWT. Any authenticated user.
- `POST /api/v1/prompts` — JWT. `restrictTo(ADMIN)`.
- `POST /api/v1/prompts/:slug/versions` — JWT. `restrictTo(ADMIN)`.
- `POST /api/v1/prompts/:slug/activate` — JWT. `restrictTo(ADMIN)`.

### Wiki
- `GET /api/v1/projects/:projectId/wiki/spaces` — JWT. `protectedProjectRoute(wiki.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/projects/:projectId/wiki/spaces` — JWT. `protectedProjectRoute(wiki.create)`. Legacy default: `A/TL`.
- `GET /api/v1/wiki/spaces/:spaceId/tree` — JWT. `protectedProjectRoute(wiki.read)`. Legacy default: `A/TL/T`.
- `POST /api/v1/wiki/pages` — JWT. `protectedProjectRoute(wiki.create)`. Legacy default: `A/TL`.
- `GET /api/v1/wiki/pages/:pageId` — JWT. `protectedProjectRoute(wiki.read)`. Legacy default: `A/TL/T`.
- `PUT /api/v1/wiki/pages/:pageId` — JWT. `protectedProjectRoute(wiki.update)`. Legacy default: `A/TL/T`.
- `PATCH /api/v1/wiki/pages/:pageId/status` — JWT. `protectedProjectRoute(wiki.update)`. Legacy default: `A/TL/T`.

## Overall Assessment
- Strongest parts of the API are the endpoints wired through `projectRoute(...)` or `protectedProjectRoute(...)`, because they consistently bind the caller to a resolved project context and a permission key.
- The remaining gap is consistency rather than tenant-boundary failure: a meaningful slice of the API still relies on coarse membership checks instead of the project permission catalog. This is a least-privilege improvement item, not an observed cross-tenant data exposure in the current verification.
- Release gate: keep AI provider/model availability as an explicit deployment prerequisite. Application code returns a controlled `503` when all providers fail; it must not be treated as a successful production readiness result.
