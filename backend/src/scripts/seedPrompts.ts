import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { MANUAL_STEP_GENERATOR_PROMPT, TEST_CASE_GENERATOR_PROMPT } from '../promptDefinitions';

const prisma = new PrismaClient();

const PROMPTS = [
    {
        slug: 'mvp-backlog-completion',
        name: 'MVP Backlog Completion',
        description: 'Generates a development-ready MVP backlog from a requirement.',
        templateBody: `
        You are an expert Agile Business Analyst.
        Your job is to produce a development-ready MVP backlog from the requirement below.

        {{langInstruction}}

        Requirement:
        "{{text}}"

        {{documentationContext}}

        Important rules:
        1. The requirement already includes enough detail to start implementation.
        2. Treat any Q/A, clarifications, assumptions, and interview notes in the requirement as authoritative.
        3. Do NOT ask more questions.
        4. Use reasonable product assumptions only for non-blocking details.
        5. Return a practical MVP backlog with epics and user stories.

        Output Format (JSON Only):
        {
          "status": "COMPLETE",
          "epics": [
            {
              "title": "Epic Title",
              "description": "Epic Description",
              "reasoning": "Why this epic was created",
              "stories": [
                {
                  "title": "Story Title",
                  "description": "As a <user>, I want <feature> so that <benefit>",
                  "acceptanceCriteria": "- Criteria 1\\n- Criteria 2",
                  "points": 3,
                  "priority": "HIGH"
                }
              ]
            }
          ]
        }

        Return ONLY the JSON object.
      `,
        outputSchema: {
            type: "object",
            properties: {
                status: { type: "string" },
                epics: { type: "array" }
            }
        }
    },
    {
        slug: 'test-case-generator',
        name: 'Test Case Generator',
        description: 'Generates comprehensive test cases for a user story.',
        templateBody: TEST_CASE_GENERATOR_PROMPT,
        outputSchema: {
            type: "object",
            properties: {
                testCases: { type: "array" }
            }
        }
    },
    {
        slug: 'business-request-analyzer',
        name: 'Business Request Analyzer',
        description: 'Analyzes raw business requirements to determine completeness and initial epics/stories.',
        templateBody: `
      You are an expert Agile Business Analyst.
      Analyze the following business requirement.

      {{langInstruction}}

      Requirement:
      "{{text}}"

      {{documentationContext}}

      Your task:
      1. Determine if the requirement is detailed enough to generate a solid backlog of epics and stories (COMPLETE).
      2. If it is NOT detailed enough, set status to "NEEDS_INFO" and generate a list of 3-5 clarification questions to ask the user.
      3. If it IS detailed enough, set status to "COMPLETE" and generate a structured list of Epics and User Stories.

      Output Format (JSON Only):
      {
        "status": "COMPLETE" | "NEEDS_INFO",
        "questions": ["Clarification question 1", "Clarification question 2"],
        "epics": [
          {
            "title": "Epic Title",
            "description": "Epic Description",
            "reasoning": "Why this epic was created",
            "stories": [
              {
                "title": "Story Title",
                "description": "As a <user>, I want <feature> so that <benefit>",
                "acceptanceCriteria": "- Criteria 1\\n- Criteria 2",
                "points": 3,
                "priority": "HIGH" | "MEDIUM" | "LOW"
              }
            ]
          }
        ]
      }
      
      Return ONLY the JSON object.
    `,
        outputSchema: {
            type: "object",
            properties: {
                status: { type: "string" },
                questions: { type: "array" },
                epics: { type: "array" }
            }
        }
    },
    {
        slug: 'project-question-generator',
        name: 'Project Question Generator',
        description: 'Generates scoping questions for new projects with example suggestions.',
        templateBody: `
      You are an expert IT Business Analyst.
      Your goal is to understand the scope of a new software project.
      
      Project Name: "{{name}}"
      Short Description: "{{description}}"

      {{langInstruction}}

      Generate 3 to 5 critical, open-ended questions.
      Focus on FUNCTIONAL scope and GOALS.
      For EACH question, provide 2 to 4 concrete, brief example suggestions to help the user choose or write their answer.

      Output Format (JSON Only):
      {
        "questions": [
          {
            "text": "The actual question text",
            "suggestions": ["Example answer 1", "Example answer 2", "Example answer 3"]
          }
        ]
      }
      
      Return ONLY the JSON object.
    `,
        outputSchema: {
            type: "object",
            properties: {
                questions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            text: { type: "string" },
                            suggestions: { type: "array", items: { type: "string" } }
                        }
                    }
                }
            }
        }
    },
    {
        slug: 'project-scope-generator',
        name: 'Project Scope Generator',
        description: 'Generates a Project Purpose & Scope document.',
        templateBody: `
      You are an expert IT Business Analyst.
      Write a comprehensive "Project Purpose & Scope" document in Markdown format.
      
      Project Name: "{{name}}"
      Short Description: "{{description}}"

      {{qaContext}}
      {{langInstruction}}

      Structure:
      # Project Purpose
      ## Business Objectives
      ## Target Audience
      ## Scope
      ### In-Scope Features
      ### Out-of-Scope
    `
    },
    {
        slug: 'project-test-strategy-generator',
        name: 'Project Test Strategy Generator',
        description: 'Generates a Project Test Strategy document.',
        templateBody: `
      You are an expert QA Manager.
      Write a clear, comprehensive "Test Strategy" document in Markdown format.
      
      Project Name: "{{name}}"
      Short Description: "{{description}}"

      {{qaContext}}
      {{langInstruction}}

      Structure:
      # Test Strategy
      ## Quality Objectives
      ## Test Levels (Unit, Integration, System, UAT)
      ## Test Types (Functional, Non-Functional, Regression)
      ## Defect Management
      ## Entry & Exit Criteria
    `
    },
    {
        slug: 'project-automation-strategy-generator',
        name: 'Project Automation Strategy Generator',
        description: 'Generates a Project Automation Strategy document.',
        templateBody: `
      You are an expert Test Automation Architect.
      Write a high-level "Automation Strategy" document in Markdown format.
      
      Project Name: "{{name}}"
      Short Description: "{{description}}"

      {{qaContext}}
      {{langInstruction}}

      Structure:
      # Automation Strategy
      ## Automation Goals & ROI
      ## Tool Stack & Framework
      ## Scope of Automation (What to automate vs what to keep manual)
      ## Execution Infrastructure (CI/CD integration)
    `
    },
    {
        slug: 'project-release-policy-generator',
        name: 'Project Release Policy Generator',
        description: 'Generates a Project Release & Rollback Policy document.',
        templateBody: `
      You are an expert Release Manager.
      Write a "Release & Rollback Policy" document in Markdown format.
      
      Project Name: "{{name}}"
      Short Description: "{{description}}"

      {{qaContext}}
      {{langInstruction}}

      Structure:
      # Release Policy
      ## Release Cadence
      ## Environments (Dev, Staging, Prod)
      ## Go/No-Go Decision Criteria
      ## Rollback Plan
    `
    },
    {
        slug: 'wiki-consolidation',
        name: 'Wiki Consolidation',
        description: 'Merges project info into a master document.',
        templateBody: `
      You are an expert Technical Writer.
      Merge project info into a SINGLE, professional "Project Master Document" in Markdown.

      Project Name: "{{name}}"
      Description: "{{description}}"
      Scope: """{{scope}}"""
      Architecture: """{{architecture}}"""

      {{langInstruction}}
    `
    },
    {
        slug: 'html-element-extractor',
        name: 'HTML Element Extractor',
        description: 'Extracts POM elements from HTML snippets.',
        templateBody: `
      You are an expert Automation QA Engineer. 
      Extract all meaningful, interactive elements from the HTML snippet.

      ## HTML Snippet
      \`\`\`html
      {{htmlSnippet}}
      \`\`\`

      Return strictly a JSON array:
      [
        { "name": "...", "locator": "...", "type": "...", "description": "..." }
      ]
    `
    },
    {
        slug: 'manual-step-generator',
        name: 'Manual Step Generator',
        description: 'Generates manual test steps for a test case.',
        templateBody: MANUAL_STEP_GENERATOR_PROMPT
    },
    {
        slug: 'release-risk-analyzer',
        name: 'Release Risk Analyzer',
        description: 'Performs a qualitative risk assessment of a release candidate.',
        templateBody: `
      You are an expert Release Manager and Risk Analyst.
      Assess the qualitative risk of the following Release Candidate.

      Release Title: "{{title}}"
      Summary: "{{summary}}"
      
      Change-Set (Traceability):
      {{workItems}}

      Current Failures & Bugs:
      {{bugs}}

      Evaluate:
      1. Technical Risk (likelihood of regressions).
      2. Business Risk (impact on users).
      3. Quality Confidence (coverage vs failure density).

      Output Format (JSON Only):
      {
        "riskScore": number (0-100, where 100 is max risk),
        "assessment": "Brief summary",
        "redFlags": ["Flag 1", "Flag 2"],
        "recommendation": "GO" | "CAUTION" | "NO-GO"
      }
    `,
        outputSchema: {
            type: "object",
            properties: {
                riskScore: { type: "number" },
                assessment: { type: "string" },
                redFlags: { type: "array" },
                recommendation: { type: "string" }
            }
        }
    },
    {
        slug: 'architecture-question-generator',
        name: 'Architecture Question Generator',
        description: 'Generates targeted architecture and technology questions for a project.',
        templateBody: `
      You are a Senior Solutions Architect with deep expertise in cloud-native, microservices, and modern web/mobile architectures.
      Your goal is to understand the architectural needs and technology choices for a new software project.

      Project Name: "{{name}}"
      Short Description: "{{description}}"

      Project Scope Summary:
      """{{scopeSummary}}"""

      {{langInstruction}}

      Based on the project's domain, scale requirements, and business goals described above, generate 4 to 6 targeted questions that will help determine:
      1. The ideal system architecture (Monolith vs Microservices, Event-driven, etc.)
      2. Frontend technology stack and frameworks
      3. Backend technology stack, language, and frameworks
      4. Database requirements (Relational, NoSQL, Graph, Cache)
      5. Infrastructure and deployment strategy (Cloud provider, containerization, CI/CD)
      6. Key design patterns and integration needs

      For EACH question, provide 2-4 concrete, actionable suggestions as examples to help the user decide.

      Output Format (JSON Only):
      {
        "questions": [
          {
            "text": "The actual question text",
            "suggestions": ["Concrete suggestion 1", "Concrete suggestion 2", "Concrete suggestion 3"]
          }
        ]
      }

      Return ONLY the JSON object.
    `
    },
    {
        slug: 'project-architecture-generator',
        name: 'Project Architecture Generator',
        description: 'Generates a professional Architecture & Technologies document.',
        templateBody: `
      You are a Senior Solutions Architect writing a comprehensive "Architecture & Technologies" document.

      Project Name: "{{name}}"
      Short Description: "{{description}}"

      Project Scope Summary:
      """{{scopeSummary}}"""

      Architecture Interview Context:
      {{qaContext}}

      {{langInstruction}}

      Write a detailed, professional Markdown document that covers:

      # Architecture & Technologies

      ## System Overview
      High-level architectural diagram description (describe a box-and-arrow style architecture).

      ## Architecture Pattern
      Describe the chosen architecture pattern and justify why it fits this project.

      ## Technology Stack
      ### Frontend
      - Framework, UI Library, State Management, Styling approach
      ### Backend
      - Language, Framework, API design (REST/GraphQL)
      ### Database
      - Primary database, caching layer, search engine if applicable
      ### Infrastructure
      - Cloud provider, containerization, orchestration

      ## Design Patterns & Best Practices
      List the key design patterns recommended for this project (e.g., Repository, CQRS, Event Sourcing, etc.) with brief justification.

      ## Integration Architecture
      External APIs, third-party services, messaging systems.

      ## Security Architecture
      Authentication, authorization, data encryption approach.

      ## Scalability & Performance
      Caching strategy, CDN, load balancing, horizontal scaling approach.

      ## DevOps & CI/CD
      Build pipeline, deployment strategy, monitoring & observability.

      Be specific, use the actual technologies and patterns discussed in the interview. 
      Do NOT use generic placeholders. Make concrete, opinionated recommendations based on the project context.
    `
    }
];

async function seed() {
    console.log('🌱 Seeding Authoritative Prompt Registry...');

    // 1. Ensure a System User exists
    let systemUser = await prisma.user.findFirst({ where: { email: 'system@nexa.ai' } });
    if (!systemUser) {
        systemUser = await prisma.user.create({
            data: {
                id: randomUUID(),
                email: 'system@nexa.ai',
                password: await bcrypt.hash(randomBytes(48).toString('base64url'), 12),
                firstName: 'System',
                lastName: 'Administrator',
                role: 'ADMIN',
                isActive: false,
                emailVerifiedAt: new Date(),
            }
        });
    } else if (systemUser.isActive) {
        systemUser = await prisma.user.update({
            where: { id: systemUser.id },
            data: { isActive: false },
        });
    }

    for (const p of PROMPTS) {
        console.log(`Processing: ${p.slug}`);
        
        const template = await prisma.promptTemplate.upsert({
            where: { slug: p.slug },
            create: {
                slug: p.slug,
                name: p.name,
                description: p.description,
                currentVersion: 1
            },
            update: {
                name: p.name,
                description: p.description
            }
        });

        // Add or update version 1 to ensure it matches the authoritative file
        const version = await prisma.promptVersion.findFirst({
            where: { templateId: template.id, version: 1 }
        });

        if (!version) {
            await (prisma as any).promptVersion.create({
                data: {
                    templateId: template.id,
                    version: 1,
                    templateBody: p.templateBody.trim(),
                    outputSchema: p.outputSchema || undefined,
                    createdById: systemUser.id
                }
            });
            console.log(`[NEW] Version 1 created for ${p.slug}`);
        } else {
            await prisma.promptVersion.update({
                where: { id: version.id },
                data: {
                    templateBody: p.templateBody.trim(),
                    outputSchema: p.outputSchema || undefined
                }
            });
            console.log(`[UPDATE] Version 1 updated for ${p.slug}`);
        }

        // Ensure currentVersion is set to 1
        await prisma.promptTemplate.update({
            where: { id: template.id },
            data: { currentVersion: 1 }
        });
    }

    console.log('✅ Seeding Complete.');
}

seed()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
