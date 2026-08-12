import { api } from "./api"
import type { ApiResponse } from "@/types/api"
import type { BusinessRequestStory } from "@/types/business-request"
import type { TestCase } from "@/types/testCase"

export interface GeneratedStep {
    action: string
    expected: string
}

export interface ExtractedElement {
    name: string
    locator: string
    type: string
    description?: string
}

export interface GeneratedTestsFromStoryResult {
    suiteId: string
    testCases: TestCase[]
}

export interface FailureAnalysisResult {
    title: string
    description: string
    stepsToReproduce: string
    severity: string
    confidence: number
    reasoning: string
}

export interface AssistantSource {
    id: string
    type: string
    similarity: number
    snippet: string
    title: string
    href: string
}

export const aiService = {
    generateSteps: async (projectId: string, title: string, context?: string, language?: string): Promise<GeneratedStep[]> => {
        const response = await api.post<ApiResponse<{ steps: GeneratedStep[] }>>("/ai/generate-steps", {
            projectId,
            title,
            context,
            language
        })
        return (response as unknown as ApiResponse<{ steps: GeneratedStep[] }>).data.steps;
    },

    generateUserStories: async (projectId: string, description: string, context?: string, language?: string): Promise<BusinessRequestStory[]> => {
        const response = await api.post<ApiResponse<{ stories: BusinessRequestStory[] }>>("/ai/generate-stories", {
            projectId,
            description,
            context,
            language
        });
        return (response as unknown as ApiResponse<{ stories: BusinessRequestStory[] }>).data.stories;
    },

    generateTestsFromStory: async (storyId: string, projectId?: string, language?: string): Promise<GeneratedTestsFromStoryResult> => {
        const response = await api.post<ApiResponse<GeneratedTestsFromStoryResult>>("/ai/generate-tests-from-story", {
            storyId,
            projectId,
            language
        });
        return response as unknown as GeneratedTestsFromStoryResult;
    },

    extractElementsFromHtml: async (projectId: string, htmlSnippet: string): Promise<ExtractedElement[]> => {
        const response = await api.post<ApiResponse<ExtractedElement[]>>(`/ai/${projectId}/extract-elements`, { htmlSnippet });
        return (response as unknown as ApiResponse<ExtractedElement[]>).data;
    },

    analyzeFailure: async (testResultId: string, language: string = 'en'): Promise<FailureAnalysisResult> => {
        const response = await api.post<ApiResponse<FailureAnalysisResult>>(`/ai/test-results/${testResultId}/analyze-failure`, { language });
        return response as unknown as FailureAnalysisResult;
    },

    chatWithAssistant: async (projectId: string, messages: { role: string; content: string }[]): Promise<{ content: string; sources: AssistantSource[] }> => {
        const response: any = await api.post(`/ai/${projectId}/chat`, {
            messages
        });
        
        const payload = response?.data?.data || response?.data || response;
        return {
            content: payload?.content || '',
            sources: payload?.sources || []
        };
    }
}
