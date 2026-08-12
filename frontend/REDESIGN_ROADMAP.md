# UI Redesign Roadmap

## Phase 0 - Design Foundation
- [x] Global color palette and token alignment (`index.css`)
- [x] Baseline spacing, borders, surface hierarchy

## Phase 1 - High-Traffic Core
- [x] `/projects` Projects list and row accordion redesign
- [x] `/dashboard` corporate dashboard redesign
- [x] `/projects/:projectId` Project details shell redesign

## Phase 2 - Planning & Collaboration
- [x] `/projects/:projectId/board` Agile board redesign
- [x] `/projects/:projectId/wiki` Wiki reading/editing layout redesign
- [x] `/projects/:projectId/ai-analyst` AI analyst workspace redesign

## Phase 3 - Execution Flow
- [x] `/runs` Test runs list redesign
- [x] `/runs/:runId` Test run detail redesign
- [x] `/projects/:projectId/cases/:caseId` Test case detail redesign

## Phase 4 - Reporting & Governance
- [x] `/reports` Reports list redesign
- [x] `/reports/:reportId` Report detail redesign
- [x] `/milestones` Milestones list redesign
- [x] `/milestones/:milestoneId` Milestone detail redesign

## Phase 5 - Account & Admin
- [x] `/profile` Profile / settings redesign
- [x] `/admin/users` User management redesign

## Phase 6 - Auth & Edge States
- [x] `/login` Login redesign
- [x] `/403` Forbidden / empty and fallback states redesign

## Rollout Rules
- Keep all redesigns responsive (desktop + mobile).
- Preserve existing functionality and permissions.
- Keep typography, spacing, border radius, and shadows consistent with brand language.
- Validate each phase with `eslint` (target files) and `vite build`.
