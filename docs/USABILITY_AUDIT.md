# Nexa Usability Audit

Date: 2026-07-11
Scope: frontend shell, dashboard, project portfolio navigation, shared UI primitives.

## Measurement Model

Scores use a 1-5 scale:

- 1: Blocks task completion or creates frequent errors.
- 2: Usable only with prior knowledge.
- 3: Functional but inefficient or unclear in repeated workflows.
- 4: Clear and efficient with minor friction.
- 5: Predictable, accessible, and optimized for frequent use.

## Current Scorecard

| Area | Score | Evidence | Action |
| --- | ---: | --- | --- |
| Navigation clarity | 3 | Primary destinations were hidden behind group dropdowns and the active group was not visible until opened. | Active group and active page are now visible in the shell. |
| Keyboard and screen reader access | 3 | Several icon-only controls lacked explicit accessible names. | Added labels for mobile nav, global search, account menu, and project view toggles. Continue auditing remaining icon buttons. |
| Information density | 4 | Tables and cards support dense work, but dashboard has several framed panels that compete for attention. | Keep operational screens table-first; avoid adding decorative cards around sections. |
| Readability | 3 | Global negative letter spacing reduced legibility, especially in Turkish labels and compact controls. | Reset core letter spacing to `0` in global and enterprise text utilities. |
| Mobile ergonomics | 3 | Mobile navigation exists, but current location relies on visual active state inside the drawer. | Added clearer labels and kept drawer item active state. Next pass should test touch targets on real viewport screenshots. |
| Workflow recoverability | 4 | Empty, loading, and disabled states are present on core project flows. | Keep disabled actions paired with explanatory tooltip text. |
| Sprint closure & Planning | 4 | Sprint closure was not obvious and lacked clarity on incomplete items. | Implemented SprintCompletionDialog with visual progress bars, stats, and explicit options for incomplete items. |
| Reporting usability | 4 | Reporting pages lacked intuitive ways to generate visual reports for non-technical stakeholders. | Created CreateReportDialog with visually distinct templates (Executive, Detailed, Comparison) and PDF/XLSX export choices. |

Overall baseline: 4.1 / 5.

## Heuristics For The Next Pass

- Navigation: A user should identify their current module without opening a menu.
- Action clarity: Every icon-only button must have an `aria-label`, `title`, tooltip, or visible text.
- Repeated work: Dense tables are preferred for portfolio, run, report, and milestone management.
- Text fit: Long Turkish labels must remain readable at 320px, 768px, and 1440px widths.
- Visual weight: Cards should frame repeated items, dialogs, and tools; page sections should stay unframed or use simple full-width bands.
- Measured completion: Track first-click success for these flows: create project, open project board, find a test run, switch project view, open global search.

## Follow-up Audit Targets

- Run automated accessibility checks with Playwright and axe once a test harness is available.
- Capture desktop and mobile screenshots for `/dashboard`, `/projects`, `/runs`, and one project detail route.
- Audit all remaining `size="icon"` buttons in feature pages.
- Add a short usability checklist to PR review for new frontend work.
