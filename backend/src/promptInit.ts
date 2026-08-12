import { promptService } from './services/prompt.service';
import prisma from './utils/prisma';
import {
  DEFAULT_TEST_PROMPT_REVISION,
  MANUAL_STEP_GENERATOR_PROMPT,
  TEST_CASE_GENERATOR_PROMPT,
} from './promptDefinitions';

export async function initializePrompts() {
  const defaultPrompts = [
    {
      slug: 'business-request-analyzer',
      name: 'Business Request Analyzer',
      description: 'Analyzes business requirements into structured Epics and User Stories.',
      templateBody: `
      You are an expert Agile Business Analyst.
      Your goal is to analyze the following business requirement and transform it into a structured backlog (Epics & User Stories).

      {{langInstruction}}

      Requirement:
      "{{text}}"

      {{documentationContext}}

      Evaluation Rules:
      1. If the requirement is vague, ambiguous, or lacks critical details (e.g., "Build a login page" without specifying OAuth or 2FA), you MAY ask clarification questions.
      2. If the requirement is sufficiently clear to start development, you MUST generate Epics and User Stories.
      3. If the requirement text already contains clarifications, interview notes, or explicit Q/A answers, you MUST treat them as authoritative context.
      4. Prefer producing a usable MVP backlog instead of blocking on non-critical unknowns.
      5. Return "NEEDS_INFO" only when the missing information would materially prevent backlog creation.
      6. When you return "NEEDS_INFO", ask at most 2 blocker questions.

      Output Format (JSON Only):
      
      Scenario A: Information Needed
      {
        "status": "NEEDS_INFO",
        "questions": ["Question 1?", "Question 2?"]
      }

      Scenario B: Analysis Complete
      {
        "status": "COMPLETE",
        "epics": [
          {
            "title": "Epic Title",
            "description": "Epic Description",
            "stories": [
              {
                "title": "User Story Title",
                "description": "User Story Description",
                "acceptanceCriteria": ["AC 1", "AC 2"],
                "storyPoints": 3,
                "technicalCategory": "CONFIG_CHANGE | BACKEND_BUGFIX | BACKEND_FEATURE | API_INTEGRATION | FRONTEND_ONLY | FULLSTACK_FEATURE | DB_MIGRATION",
                "impactedLayers": ["FRONTEND", "BACKEND", "DATABASE", "API", "CONFIG"],
                "frontendImpact": true,
                "testingStrategy": "Detailed description of required testing types (API_CONTRACT, UI_PLAYWRIGHT, INTEGRATION_UNIT, CONFIG_VERIFICATION)"
              }
            ]
          }
        ]
      }
      `
    },
    {
      slug: 'test-case-generator',
      name: 'Test Case Generator',
      description: 'Generates deduplicated and targeted test cases based on task technical classification and frontend impact.',
      templateBody: TEST_CASE_GENERATOR_PROMPT
    },
    {
      slug: 'manual-step-generator',
      name: 'Manual Step Generator',
      description: 'Generates complete, atomic manual test steps for a scenario.',
      templateBody: MANUAL_STEP_GENERATOR_PROMPT
    }
  ];

  for (const p of defaultPrompts) {
    const existing = await prisma.promptTemplate.findUnique({ where: { slug: p.slug } });
    if (!existing) {
      await promptService.createTemplate(p.slug, p.name, p.description);
      await promptService.addVersion(p.slug, { templateBody: p.templateBody });
      console.log(`Initialized prompt: ${p.slug}`);
      continue;
    }

    // Upgrade old installations once, while preserving an administrator's
    // already-active later version. This also makes `npm run dev` pick up the
    // richer defaults without requiring a database reset.
    if (p.slug === 'test-case-generator' || p.slug === 'manual-step-generator') {
      const details = await promptService.getTemplateDetails(p.slug);
      const hasCurrentDefault = details?.versions.some((version) =>
        version.templateBody.includes(DEFAULT_TEST_PROMPT_REVISION)
      );

      if (!hasCurrentDefault && details?.currentVersion === 1) {
        const version = await promptService.addVersion(p.slug, { templateBody: p.templateBody });
        await promptService.activateVersion(p.slug, version.version);
        console.log(`Upgraded prompt: ${p.slug} -> v${version.version}`);
      }
    }
  }
}
