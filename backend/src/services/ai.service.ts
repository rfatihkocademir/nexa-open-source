import prisma from '../utils/prisma';
import { buildDescriptionWithDocumentation, extractDocumentationMeta } from '../utils/workItemDocumentation';
import { generateAIJson, generateAIText } from './aiProvider.service';
import { promptService } from './prompt.service';
import { createLogger } from '../utils/logger';
import { AppError } from '../utils/AppError';

const logger = createLogger('AIService');

export type TechnicalTaskCategory =
  | 'CONFIG_CHANGE'
  | 'BACKEND_BUGFIX'
  | 'BACKEND_FEATURE'
  | 'API_INTEGRATION'
  | 'FRONTEND_ONLY'
  | 'FULLSTACK_FEATURE'
  | 'DB_MIGRATION';

export interface RequirementAnalysisStory {
  title: string;
  description: string;
  acceptanceCriteria?: string[] | string;
  points?: number;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  technicalCategory?: TechnicalTaskCategory;
  impactedLayers?: Array<'FRONTEND' | 'BACKEND' | 'DATABASE' | 'API' | 'CONFIG'>;
  frontendImpact?: boolean;
  testingStrategy?: string;
}

export interface RequirementAnalysisEpic {
  title: string;
  description: string;
  reasoning?: string;
  stories?: RequirementAnalysisStory[];
}

export interface RequirementAnalysisResult {
  status: 'NEEDS_INFO' | 'COMPLETE';
  questions?: string[];
  epics?: RequirementAnalysisEpic[];
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export function buildLanguageInstruction(language: string = 'en'): string {
  const requestedLanguage = language?.trim() || 'en';
  const normalizedLanguage = requestedLanguage.toLowerCase();

  if (normalizedLanguage.startsWith('tr')) {
    return 'IMPORTANT: You MUST write ALL output text (titles, descriptions, preconditions, steps, expected results) in Turkish. Only JSON keys should remain in English.';
  }

  if (normalizedLanguage.startsWith('en')) {
    return 'IMPORTANT: You MUST write ALL output text (titles, descriptions, preconditions, steps, expected results) in English. Only JSON keys should remain in English.';
  }

  return `IMPORTANT: You MUST write ALL output text (titles, descriptions, preconditions, steps, expected results) in the requested user language (${requestedLanguage}). Only JSON keys should remain in English.`;
}

export function calculateRiskLevel(category?: TechnicalTaskCategory, impactedLayers?: string[]): RiskLevel {
  if (category === 'DB_MIGRATION') return 'CRITICAL';
  if (category === 'FULLSTACK_FEATURE') return 'HIGH';
  if (category === 'API_INTEGRATION') return 'HIGH';
  
  if (impactedLayers && impactedLayers.includes('DATABASE')) return 'HIGH';
  
  if (category === 'BACKEND_FEATURE' || category === 'BACKEND_BUGFIX') return 'MEDIUM';
  if (category === 'CONFIG_CHANGE') return 'MEDIUM';
  
  if (category === 'FRONTEND_ONLY') return 'LOW';
  
  return 'MEDIUM'; // Default risk
}

export function deduplicateTestCases(newCases: any[], existingCases: any[]): any[] {
  const existingTitles = new Set(existingCases.map(c => c.title.toLowerCase().trim()));
  const uniqueCases: any[] = [];

  for (const tc of newCases) {
    const title = (tc.title || tc.name || '').toLowerCase().trim();
    if (!title) continue;

    const isDuplicate = Array.from(existingTitles).some(existing => {
      if (existing === title) return true;
      if (title.length > 15 && existing.includes(title)) return true;
      if (existing.length > 15 && title.includes(existing)) return true;
      return false;
    });

    if (!isDuplicate) {
      existingTitles.add(title);
      uniqueCases.push(tc);
    }
  }

  return uniqueCases;
}

function shouldForceBacklogCompletion(text: string, result: RequirementAnalysisResult): boolean {
  if (result.status !== 'NEEDS_INFO') {
    return false;
  }

  const normalized = text.toLowerCase();
  const hasExplicitQa = /\bq\s*:|\bquestion\s*:|\ba\s*:|\banswer\s*:/.test(normalized);
  const looksDetailed = text.length > 300;

  return hasExplicitQa || looksDetailed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeWikiContent(content: unknown, maxLength: number = 4000): string {
  if (!content) {
    return '';
  }

  let raw = '';
  if (typeof content === 'string') {
    raw = content;
  } else if (typeof content === 'object' && content !== null && 'content' in content) {
    const innerContent = (content as { content?: unknown }).content;
    raw = typeof innerContent === 'string' ? innerContent : JSON.stringify(content);
  } else {
    raw = JSON.stringify(content);
  }

  const plainText = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength)}...`;
}

function buildEpicDocumentationHtml(epicData: any): { type: 'html'; content: string } {
  const title = typeof epicData?.title === 'string' ? epicData.title : 'Untitled Epic';
  const description = typeof epicData?.description === 'string'
    ? epicData.description
    : 'No epic description provided.';
  const reasoning = typeof epicData?.reasoning === 'string'
    ? epicData.reasoning
    : 'Reasoning is not provided.';

  return {
    type: 'html',
    content: [
      `<h2>${escapeHtml(title)}</h2>`,
      `<h3>Description</h3><p>${escapeHtml(description)}</p>`,
      `<h3>Analysis Reasoning</h3><p>${escapeHtml(reasoning)}</p>`
    ].join('')
  };
}

function aiUnavailable(operation: string, error: unknown): AppError {
  if (error instanceof AppError) return error;
  logger.error(`${operation} failed because the AI provider is unavailable`, error);
  return new AppError(`${operation} is temporarily unavailable. Please retry shortly.`, 503);
}

export const aiAnalystService = {
  async analyzeRequirement(
    text: string,
    language: string = 'en',
    context?: { wikiSummary?: string }
  ): Promise<RequirementAnalysisResult> {
    const langInstruction = language?.toLowerCase().startsWith('tr')
      ? 'IMPORTANT: You MUST write ALL output text (titles, descriptions, questions, acceptance criteria, reasoning) in Turkish. Only JSON keys should remain in English.'
      : 'Write all output text in English.';

    const documentationContext = context?.wikiSummary
      ? `
      You also have the following existing project documentation summary:

      "${context.wikiSummary}"

      When deciding whether to ask clarification questions, FIRST read and use this documentation.
      NEVER ask for information (such as technology stack, architecture, high-level purpose or scope) if it is already clearly described in this documentation.
      Only ask questions for details that are truly missing or ambiguous after considering both the requirement text and the documentation.
      `
      : '';

    const prompt = await promptService.renderPrompt('business-request-analyzer', {
      langInstruction,
      text,
      documentationContext
    });

    try {
      const initialResult = await generateAIJson<RequirementAnalysisResult>(prompt);
      if (!shouldForceBacklogCompletion(text, initialResult)) {
        return initialResult;
      }

      const completionPrompt = await promptService.renderPrompt('mvp-backlog-completion', {
        langInstruction,
        text,
        documentationContext
      });

      const completionResult = await generateAIJson<RequirementAnalysisResult>(completionPrompt);
      if (completionResult.status === 'COMPLETE' && (completionResult.epics?.length ?? 0) > 0) {
        return completionResult;
      }

      return initialResult;
    } catch (error) {
      logger.error('AI generation error:', error);
      throw aiUnavailable('AI analysis', error);
    }
  },

  async createBatch(projectId: string, data: { epics: any[] }, userId: string, sourceRequestId?: string) {
    return prisma.$transaction(async (tx) => {
      const results = [];

      if (sourceRequestId) {
        // Serialize retries/concurrent approvals for the same business request.
        // The request status check happens outside this transaction, so it is not
        // sufficient protection by itself.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sourceRequestId}))`;
      }

      let documentationSpace = await tx.wikiSpace.findFirst({
        where: { projectId, name: 'Documentation' },
        select: { id: true }
      });

      if (!documentationSpace) {
        documentationSpace = await tx.wikiSpace.create({
          data: {
            name: 'Documentation',
            description: 'Project documentation',
            icon: 'book',
            projectId
          },
          select: { id: true }
        });
      }

      for (const epicData of data.epics) {
        const epicTitle = typeof epicData?.title === 'string' ? epicData.title.trim() : '';
        if (!epicTitle) continue;
        if (sourceRequestId) {
          const existingEpic = await tx.workItem.findFirst({
            where: {
              projectId,
              sourceRequestId,
              itemType: 'EPIC',
              title: epicTitle,
              deletedAt: null,
            },
          });
          if (existingEpic) {
            results.push(existingEpic);
            continue;
          }
        }

        const projectCounters = await tx.project.update({
          where: { id: projectId },
          data: { nextWikiPageNumber: { increment: 1 }, nextWorkItemNumber: { increment: 1 } },
          select: { key: true, nextWikiPageNumber: true, nextWorkItemNumber: true },
        });
        const epicDocumentationPage = await tx.wikiPage.create({
          data: {
            key: `${projectCounters.key}-DOC-${projectCounters.nextWikiPageNumber - 1}`,
            title: `Epic: ${epicTitle}`,
            content: buildEpicDocumentationHtml(epicData),
            spaceId: documentationSpace.id,
            authorId: userId
          },
          select: { id: true }
        });

        const epicSeq = projectCounters.nextWorkItemNumber - 1;

        const epic = await tx.workItem.create({
          data: {
            title: epicTitle,
            description: buildDescriptionWithDocumentation(epicData.description, epicDocumentationPage.id),
            projectId,
            status: 'OPEN',
            itemType: 'EPIC',
            priority: 'MEDIUM',
            sourceRequestId: sourceRequestId || undefined,
            key: `${projectCounters.key}-${epicSeq}`,
            sequenceNumber: epicSeq
          }
        });

        const stories = Array.isArray(epicData.stories) ? epicData.stories : [];
        for (const storyData of stories) {
          const storyTitle = typeof storyData?.title === 'string' ? storyData.title.trim() : '';
          if (!storyTitle) continue;
          const parsedStoryPoints = Number(storyData.points);

          const projectStory = await tx.project.update({
              where: { id: projectId },
              data: { nextWorkItemNumber: { increment: 1 } },
              select: { key: true, nextWorkItemNumber: true },
          });
          const storySeq = projectStory.nextWorkItemNumber - 1;
          const categoryTag = storyData.technicalCategory ? `[${storyData.technicalCategory}] ` : '';
          const title = categoryTag ? `${categoryTag}${storyTitle}` : storyTitle;

          let enrichedDescription = storyData.description || '';
          if (storyData.technicalCategory || storyData.impactedLayers || storyData.testingStrategy) {
            const layersStr = Array.isArray(storyData.impactedLayers) ? storyData.impactedLayers.join(', ') : 'GENERAL';
            const impactStr = storyData.frontendImpact === false ? 'No Frontend Impact (Backend/Config Only)' : 'Frontend & API Contract Impacted';
            enrichedDescription += `\n\n---\n**Technical Breakdown & Impact Analysis:**\n- **Category:** ${storyData.technicalCategory || 'FULLSTACK_FEATURE'}\n- **Impacted Layers:** ${layersStr}\n- **UI Impact:** ${impactStr}\n- **Recommended Testing:** ${storyData.testingStrategy || 'Automated API & Contract Verification'}`;
          }

          await tx.workItem.create({
            data: {
              title,
              description: enrichedDescription,
              customFields: {
                technicalCategory: storyData.technicalCategory || null,
                impactedLayers: storyData.impactedLayers || null,
                frontendImpact: storyData.frontendImpact ?? null,
                testingStrategy: storyData.testingStrategy || null,
                riskLevel: calculateRiskLevel(storyData.technicalCategory, storyData.impactedLayers as string[])
              },
              acceptanceCriteria: Array.isArray(storyData.acceptanceCriteria) 
                ? storyData.acceptanceCriteria.map((c: string) => `- ${c}`).join('\n') 
                : storyData.acceptanceCriteria,
              storyPoints: Number.isFinite(parsedStoryPoints) ? Math.max(0, Math.round(parsedStoryPoints)) : null,
              priority: storyData.priority || 'MEDIUM',
              status: 'TODO',
              itemType: 'STORY',
              projectId,
              parentId: epic.id,
              reporterId: userId,
              sourceRequestId: sourceRequestId || undefined,
              key: `${projectStory.key}-${storySeq}`,
              sequenceNumber: storySeq
            }
          });
        }

        results.push(epic);
      }

      return results;
    });
  },

  async generateTestCasesFromStory(workItemId: string, userId: string, language: string = 'en') {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workItemId);
    const story = await prisma.workItem.findFirst({
      where: isUUID ? { id: workItemId } : { key: workItemId },
      include: { project: true, parent: true }
    });

    if (!story) throw new AppError('Story not found', 404);

    const langInstruction = buildLanguageInstruction(language);
    const storyCustomFields = story.customFields && typeof story.customFields === 'object' && !Array.isArray(story.customFields)
      ? story.customFields as Record<string, unknown>
      : {};
    const technicalCategory = typeof storyCustomFields.technicalCategory === 'string'
      ? storyCustomFields.technicalCategory
      : 'FULLSTACK_FEATURE';
    const frontendImpact = typeof storyCustomFields.frontendImpact === 'boolean'
      ? storyCustomFields.frontendImpact
      : true;

    const sanitizedStoryMeta = extractDocumentationMeta(story.description);
    let epicDocumentationContext = '';

    if (story.parent?.description) {
      const parentEpicMeta = extractDocumentationMeta(story.parent.description);
      if (parentEpicMeta.documentationPageId) {
        const epicDocPage = await prisma.wikiPage.findUnique({
          where: { id: parentEpicMeta.documentationPageId },
          select: { content: true }
        });
        epicDocumentationContext = normalizeWikiContent(epicDocPage?.content);
      }
    }

    let prompt = await promptService.renderPrompt('test-case-generator', {
      langInstruction,
      title: story.title,
      description: sanitizedStoryMeta.description ? `Description: "${sanitizedStoryMeta.description}"` : '',
      acceptanceCriteria: story.acceptanceCriteria ? `Acceptance Criteria: "${story.acceptanceCriteria}"` : '',
      epicDocumentationContext: epicDocumentationContext ? `Epic Documentation Context: "${epicDocumentationContext}"` : '',
      technicalCategory,
      frontendImpact
    });

    // Keep the language requirement effective for older/custom prompt versions
    // that do not contain the {{langInstruction}} placeholder.
    if (!prompt.includes(langInstruction)) {
      prompt = `${prompt}\n\n${langInstruction}`;
    }

    const generated = await generateAIJson<any>(prompt);
    logger.info("DEBUG: Generated test cases raw JSON: " + JSON.stringify(generated));

    // 1. Determine Parent Suite (Epic Level)
    let parentSuiteName = 'Uncategorized Stories';
    let parentSuiteDescription = 'Test cases for stories without an epic';

    if (story.parent) {
      parentSuiteName = story.parent?.title;
      parentSuiteDescription = `Test suites for the "${story.parent?.title}" epic`;
    }

    let parentSuite = await prisma.testSuite.findFirst({
      where: {
        projectId: story.projectId,
        name: parentSuiteName,
        parentId: null, // Ensure it's a root suite
        deletedAt: null
      }
    });

    if (!parentSuite) {
      parentSuite = await prisma.testSuite.create({
        data: {
          name: parentSuiteName,
          description: parentSuiteDescription,
          projectId: story.projectId
        }
      });
    }

    // 2. Determine Child Suite (Story Level)
    const storySuiteName = story.title;
    const storySuiteDescription = `Test cases for story: ${story.title}`;

    let storySuite = await prisma.testSuite.findFirst({
      where: {
        projectId: story.projectId,
        name: storySuiteName,
        parentId: parentSuite.id,
        deletedAt: null
      }
    });

    if (!storySuite) {
      storySuite = await prisma.testSuite.create({
        data: {
          name: storySuiteName,
          description: storySuiteDescription,
          projectId: story.projectId,
          parentId: parentSuite.id
        }
      });
    }

    // Fetch existing test cases in this suite to prevent duplicate creation
    const existingSuiteCases = await prisma.testCase.findMany({
      where: { suiteId: storySuite.id, deletedAt: null },
      select: { title: true }
    });

    // Use storySuite for creating test cases
    const suite = storySuite;

    // Create test cases in database
    const createdCases = [];
    
    // Normalize response: Ensure we extract the test cases list properly
    let rawCasesList: any[] = [];
    if (Array.isArray(generated)) {
      rawCasesList = generated;
    } else if (generated && typeof generated === 'object') {
      rawCasesList = generated.testCases || generated.test_cases || generated.cases || generated.data || Object.values(generated).find(v => Array.isArray(v)) || [];
    }

    // Filter out duplicates against existing test cases in database
    const testCasesList = deduplicateTestCases(rawCasesList, existingSuiteCases);

    for (const tc of testCasesList) {
      const projectTC = await prisma.project.update({
          where: { id: story.projectId },
          data: { nextTestCaseNumber: { increment: 1 } },
          select: { key: true, nextTestCaseNumber: true },
      });
      const tcSeq = projectTC.nextTestCaseNumber - 1;

      let enhancedDescription = tc.description || tc.summary || '';
      const criterionIndexes = Array.isArray(tc.acceptanceCriterionIndexes)
        ? tc.acceptanceCriterionIndexes.filter((index: unknown) => Number.isInteger(index))
        : tc.acceptanceCriterionIndex !== undefined
          ? [tc.acceptanceCriterionIndex]
          : [];
      if (criterionIndexes.length > 0) {
        const traceabilityStr = `\n\n**Traceability**: This test case verifies Acceptance Criteria #${criterionIndexes.join(', #')}`;
        enhancedDescription = enhancedDescription ? enhancedDescription + traceabilityStr : traceabilityStr;
      }

      const tcSteps = Array.isArray(tc.steps)
        ? tc.steps
        : (Array.isArray(tc.testSteps) ? tc.testSteps : (Array.isArray(tc.actions) ? tc.actions : []));
      const serializedSteps = tcSteps.map((step: any, index: number) => ({
        action: step.action || step.name || step.step || step.instruction || '',
        expected: step.expected || step.expectedResult || step.result || '',
        expectedResult: step.expected || step.expectedResult || step.result || '',
        type: String(step.type || step.platform || '').toUpperCase() === 'WEB'
          || String(step.type || step.platform || '').toUpperCase() === 'MOBILE'
          ? String(step.type || step.platform).toUpperCase()
          : 'MANUAL',
        actionType: step.actionType || step.automationAction || '',
        locator: step.locator || step.selector || '',
        data: step.data !== undefined ? String(step.data) : '',
        order: index + 1,
      }));

      const testCase = await prisma.testCase.create({
        data: {
          title: tc.title || tc.name || 'Untitled Test Case',
          description: enhancedDescription || null,
          preconditions: tc.preconditions || tc.precondition || null,
          priority: tc.priority || 'MEDIUM',
          steps: serializedSteps,
          status: 'DRAFT',
          version: 1,
          suiteId: suite.id,
          authorId: userId,
          key: `${projectTC.key}-TC-${tcSeq}`, // Distinct key for test cases
          sequenceNumber: tcSeq
        }
      });

      // Connect WorkItem with TestCase
      await prisma.workItem.update({
        where: { id: story.id },
        data: {
          testCases: {
            connect: { id: testCase.id }
          }
        }
      });

      for (let i = 0; i < tcSteps.length; i++) {
        const s = tcSteps[i];
        const requestedType = String(s.type || s.platform || '').toUpperCase();
        const inferredType = requestedType === 'WEB' || requestedType === 'MOBILE'
          ? requestedType
          : (s.locator || s.selector || s.actionType || s.data || s.automation ? 'WEB' : 'MANUAL');
        const newStep = await prisma.testStep.create({
          data: {
            projectId: suite.projectId,
            action: s.action || s.name || s.step || s.instruction || '',
            expectedResult: s.expected || s.expectedResult || s.result || '',
            type: inferredType as any,
            actionType: s.actionType || s.automationAction || null,
            locator: s.locator || s.selector || null,
            data: s.data !== undefined ? String(s.data) : null,
          }
        });
        await prisma.testCaseStep.create({
          data: {
            testCaseId: testCase.id,
            testStepId: newStep.id,
            orderIndex: i
          }
        });
      }
      createdCases.push(testCase);
    }

    return { suiteId: suite.id, testCases: createdCases };
  },

  async generateProjectQuestions(name: string, description: string, language: string = 'en') {
    const langInstruction = language?.toLowerCase().startsWith('tr')
      ? 'IMPORTANT: You MUST write ALL output text (questions) in Turkish. Only JSON keys should remain in English.'
      : 'Write all output text in English.';

    const prompt = await promptService.renderPrompt('project-question-generator', {
      name,
      description,
      langInstruction
    });

    let result: any;
    try {
      result = await generateAIJson<any>(prompt);
    } catch (error) {
      throw aiUnavailable('Project question generation', error);
    }
    
    // Normalize response: Ensure it has a 'questions' array
    let rawList = [];
    if (Array.isArray(result)) {
      rawList = result;
    } else if (result && typeof result === 'object') {
      rawList = result.questions || result.data || Object.values(result).find(v => Array.isArray(v)) || [];
    }

    // Deep normalization of each question object
    const questions = rawList.map((q: any) => {
      if (typeof q === 'string') return { text: q, suggestions: [] };
      
      // Look for text in common keys
      const text = q.text || q.question || q.q || q.content || Object.values(q).find(v => typeof v === 'string') || '';
      const suggestions = Array.isArray(q.suggestions) ? q.suggestions : [];
      
      return { text, suggestions };
    });

    return { questions };
  },

  async generateProjectScope(name: string, description: string, qaPairs: { question: string; answer: string }[] = [], language: string = 'en') {
    const langInstruction = language?.toLowerCase().startsWith('tr')
      ? 'IMPORTANT: You MUST write the ENTIRE document in Turkish.'
      : 'Write the document in English.';

    const qaContext = qaPairs && qaPairs.length > 0
      ? `
      Additional Context from User Interview:
      ${qaPairs.map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}
      `
      : '';

    const prompt = await promptService.renderPrompt('project-scope-generator', {
      name,
      description,
      qaContext,
      langInstruction
    });

    try {
      const text = await generateAIText(prompt);
      return { scope: text };
    } catch (error) {
      logger.error('AI scope generation error:', error);
      throw aiUnavailable('Scope document generation', error);
    }
  },

  async generateConsolidatedWiki(name: string, description: string, scope: string, architecture: string, language: string = 'en') {
    const langInstruction = language?.toLowerCase().startsWith('tr')
      ? 'IMPORTANT: You MUST write the ENTIRE document in Turkish.'
      : 'Write the document in English.';

    const prompt = await promptService.renderPrompt('wiki-consolidation', {
      name,
      description,
      scope,
      architecture,
      langInstruction
    });

    try {
      const text = await generateAIText(prompt);
      return { wiki: text };
    } catch (error) {
      logger.error('AI wiki consolidation error:', error);
      throw aiUnavailable('Wiki consolidation', error);
    }
  },

  // Extract POM elements from raw HTML snippet
  async extractElementsFromHtml(htmlSnippet: string): Promise<any[]> {
    const prompt = await promptService.renderPrompt('html-element-extractor', {
      htmlSnippet
    });

    try {
      return await generateAIJson<any[]>(prompt);
    } catch (error) {
      throw aiUnavailable('HTML element extraction', error);
    }
  },

  async generateDocumentationSuite(name: string, description: string, qaPairs: { question: string; answer: string }[] = [], language: string = 'en') {
    const langInstruction = language?.toLowerCase().startsWith('tr')
      ? 'IMPORTANT: You MUST write the ENTIRE document in Turkish.'
      : 'Write the document in English.';

    const qaContext = qaPairs && qaPairs.length > 0
      ? `
      Additional Context from User Interview:
      ${qaPairs.map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}
      `
      : '';

    const isTurkish = language?.toLowerCase().startsWith('tr');
    
    const templates = [
      { key: 'scope', slug: 'project-scope-generator', title: isTurkish ? 'Proje Kapsamı ve Amacı' : 'Project Scope and Purpose' },
      { key: 'testStrategy', slug: 'project-test-strategy-generator', title: isTurkish ? 'Test Stratejisi' : 'Test Strategy' },
      { key: 'automationStrategy', slug: 'project-automation-strategy-generator', title: isTurkish ? 'Otomasyon Stratejisi' : 'Automation Strategy' },
      { key: 'releasePolicy', slug: 'project-release-policy-generator', title: isTurkish ? 'Sürüm ve Yayınlama Politikası' : 'Release and Deployment Policy' }
    ];

    const generateDoc = async (slug: string) => {
      const prompt = await promptService.renderPrompt(slug, {
        name,
        description,
        qaContext,
        langInstruction
      });
      return generateAIText(prompt);
    };

    try {
      const suite: any = {
        docs: {},
        titles: {}
      };
      
      const generatedDocuments = await Promise.all(templates.map(async (template) => ({
        key: template.key,
        title: template.title,
        document: await generateDoc(template.slug),
      })));
      for (const document of generatedDocuments) {
        suite.docs[document.key] = document.document;
        suite.titles[document.key] = document.title;
      }

      return suite;
    } catch (error) {
      logger.error('AI documentation suite generation error:', error);
      throw aiUnavailable('Documentation suite generation', error);
    }
  },


  async generateStoriesSynchronous(description: string, language: string = 'en') {
    const analysis = await this.analyzeRequirement(description, language);
    if (analysis.status === 'COMPLETE' && analysis.epics) {
      // Flatten all stories from all epics into a single list as the frontend expects
      const allStories = [];
      for (const epic of analysis.epics) {
        if (epic.stories) {
          allStories.push(...epic.stories.map(s => ({
            ...s,
            epicTitle: epic.title,
            epicDescription: epic.description
          })));
        }
      }
      return allStories;
    }
    return [];
  },

  async generateManualSteps(title: string, context?: string, language: string = 'en') {
    const langInstruction = language?.toLowerCase().startsWith('tr')
      ? 'IMPORTANT: You MUST write ALL output text (action, expected) in Turkish. Only JSON keys should remain in English.'
      : 'Write all output text in English.';

    const prompt = await promptService.renderPrompt('manual-step-generator', {
      title,
      context: context ? `Context: "${context}"` : '',
      langInstruction
    });

    const result = await generateAIJson<{ steps: any[] }>(prompt);
    return result.steps || [];
  },

  async generateArchitectureQuestions(name: string, description: string, scopeSummary: string, language: string = 'en') {
    const langInstruction = language?.toLowerCase().startsWith('tr')
      ? 'IMPORTANT: You MUST write ALL output text (questions, suggestions) in Turkish. Only JSON keys should remain in English.'
      : 'Write all output text in English.';

    const prompt = await promptService.renderPrompt('architecture-question-generator', {
      name,
      description,
      scopeSummary: scopeSummary || 'No scope document generated yet.',
      langInstruction
    });

    let result: any;
    try {
      result = await generateAIJson<any>(prompt);
    } catch (error) {
      throw aiUnavailable('Architecture question generation', error);
    }
    
    // Normalize response
    let rawList = [];
    if (Array.isArray(result)) {
      rawList = result;
    } else if (result && typeof result === 'object') {
      rawList = result.questions || result.data || Object.values(result).find(v => Array.isArray(v)) || [];
    }

    const questions = rawList.map((q: any) => {
      if (typeof q === 'string') return { text: q, suggestions: [] };
      const text = q.text || q.question || q.q || q.content || Object.values(q).find(v => typeof v === 'string') || '';
      const suggestions = Array.isArray(q.suggestions) ? q.suggestions : [];
      return { text, suggestions };
    });

    return { questions };
  },

  async generateArchitectureDocument(name: string, description: string, scopeSummary: string, qaPairs: { question: string; answer: string }[] = [], language: string = 'en') {
    const langInstruction = language?.toLowerCase().startsWith('tr')
      ? 'IMPORTANT: You MUST write the ENTIRE document in Turkish.'
      : 'Write the document in English.';

    const qaContext = qaPairs && qaPairs.length > 0
      ? qaPairs.map((qa, i) => `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
      : 'No architecture interview conducted.';

    const prompt = await promptService.renderPrompt('project-architecture-generator', {
      name,
      description,
      scopeSummary: scopeSummary || 'No scope document available.',
      qaContext,
      langInstruction
    });

    try {
      const text = await generateAIText(prompt);
      return { architecture: text };
    } catch (error) {
      logger.error('AI architecture generation error:', error);
      throw aiUnavailable('Architecture document generation', error);
    }
  }
};
