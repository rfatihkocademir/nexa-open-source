import * as cheerio from 'cheerio';
import { generateAIJson } from './aiProvider.service';
import { createLogger } from '../utils/logger';
type ActionType = 'NAVIGATE' | 'CLICK' | 'FILL' | 'EXTRACT' | 'ASSERT' | 'ASSERT_VISIBLE' | 'ASSERT_TEXT' | 'WAIT' | 'SELECT' | 'SET_COOKIE' | 'SET_LOCAL_STORAGE' | 'API_REQUEST';

const logger = createLogger('StepSuggestionService');

export interface SuggestedStep {
    name: string;
    locator: string; // Can be a single selector or a JSON array of selectors for fallback
    actionType: ActionType;
    description?: string;
    confidence: number;
}

export class StepSuggestionService {
    async suggest(html: string): Promise<SuggestedStep[]> {
        try {
            const aiSuggestions = await this.suggestWithAI(html);
            if (aiSuggestions && aiSuggestions.length > 0) {
                return aiSuggestions;
            }
        } catch (error) {
            logger.error('AI suggestion failed, falling back to heuristic:', error);
        }

        return this.suggestHeuristic(html);
    }

    private async suggestWithAI(html: string): Promise<SuggestedStep[]> {
        const prompt = `
        You are an expert Test Automation Engineer using Playwright. 
        Analyze the following HTML snippet and suggest a comprehensive list of automation steps to fully test this UI.
        
        **IMPORTANT: All names and descriptions MUST be in Turkish.**
        
        HTML:
        \`\`\`html
        ${html.substring(0, 15000)} 
        \`\`\`
        
        Rules:
        1. **Cover All Interactions:** Identify all interactive elements (inputs, buttons, links, dropdowns).
           - Use 'FILL' for inputs/textareas.
           - Use 'CLICK' for buttons/links.
           - Use 'SELECT' for <select> elements.
        2. **Add Assertions:** For every critical element or text, add an assertion.
           - Use 'ASSERT_VISIBLE' to verify element presence.
           - Use 'ASSERT_TEXT' to verify specific text content.
        3. **Logical Flow:** Order the steps in a logical user flow.
        4. **Robust Locators (Fallbacks):** Suggest multiple locators for each element to reduce flakiness.
           - Prefer 'data-test', 'data-testid', 'id'.
           - Then text locators (text="Submit"), then name attributes.
           - Avoid brittle CSS chains.
        
        Output Format:
        Return ONLY a JSON array of objects with these fields:
        - name: Descriptive name in Turkish (e.g., "Kullanıcı Adını Doldur", "Giriş Butonuna Tıkla", "Başlığı Doğrula").
        - locator: A JSON array of Playwright locator strings (e.g., ["#login", "text='Giriş Yap'"]).
        - actionType: One of ["FILL", "CLICK", "ASSERT_TEXT", "ASSERT_VISIBLE", "NAVIGATE", "WAIT", "SELECT"].
        - description: Brief explanation in Turkish.
        - confidence: Number 0.0-1.0.
        
        Example Output:
        [
          { "name": "Kullanıcı Adı Alanını Doldur", "locator": "[\"[data-test='user-name']\", \"#user-name\"]", "actionType": "FILL", "description": "Geçerli kullanıcı adını girer", "confidence": 1.0 },
          { "name": "Giriş Yap Butonuna Tıkla", "locator": "[\"#login-button\", \"text='Giriş Yap'\"]", "actionType": "CLICK", "description": "Giriş yap butonuna tıklar", "confidence": 1.0 }
        ]
        `;

        try {
            const suggestions = await generateAIJson<any[]>(prompt);

            return suggestions.map((s: any) => ({
                name: s.name,
                locator: Array.isArray(s.locator) ? JSON.stringify(s.locator) : s.locator,
                actionType: s.actionType as ActionType,
                description: s.description,
                confidence: s.confidence
            }));
        } catch (error) {
            logger.error('AI generation error:', error);
            throw error;
        }
    }

    suggestHeuristic(html: string): SuggestedStep[] {
        const $ = cheerio.load(html);
        const suggestions: SuggestedStep[] = [];

        // Helper to generate prioritized locators
        const getLocators = (el: any): string[] => {
            const $el = $(el);
            const locators: string[] = [];
            const tagName = el.tagName.toLowerCase();
            const id = $el.attr('id');
            const dataTest = $el.attr('data-test') || $el.attr('data-testid');
            const name = $el.attr('name');
            const placeholder = $el.attr('placeholder');
            const text = $el.text().trim();

            if (dataTest) locators.push(`[data-test="${dataTest}"]`);
            if (id) locators.push(`#${id}`);
            if (name) locators.push(`${tagName}[name="${name}"]`);
            if (placeholder) locators.push(`${tagName}[placeholder="${placeholder}"]`);
            if (text && text.length < 30) locators.push(`text=${text}`);

            return locators;
        };

        // 1. Inputs
        $('input, textarea').each((_, el) => {
            const $el = $(el);
            const type = $el.attr('type');
            if (['hidden', 'submit', 'button', 'image', 'checkbox', 'radio'].includes(type || '')) return;

            const locs = getLocators(el);
            if (locs.length === 0) return;

            const label = $el.attr('placeholder') || $el.attr('name') || $el.attr('id') || 'Alan';

            suggestions.push({
                name: `${label} Alanını Doldur`,
                locator: JSON.stringify(locs),
                actionType: 'FILL' as ActionType,
                confidence: 0.8,
                description: `${label} alanına veri girişi yapar`
            });
        });

        // 2. Selects
        $('select').each((_, el) => {
            const locs = getLocators(el);
            if (locs.length === 0) return;

            const label = $(el).attr('name') || $(el).attr('id') || 'Seçenek';

            suggestions.push({
                name: `${label} Seç`,
                locator: JSON.stringify(locs),
                actionType: 'SELECT' as ActionType,
                confidence: 0.9,
                description: `${label} listesinden seçim yapar`
            });
        });

        // 3. Buttons and Links
        $('button, input[type="submit"], input[type="button"], a, [role="button"]').each((_, el) => {
            const $el = $(el);
            const text = $el.text().trim();
            const locs = getLocators(el);
            if (locs.length === 0) return;

            const label = text || $el.attr('id') || 'Buton';

            suggestions.push({
                name: `${label} Butonuna Tıkla`,
                locator: JSON.stringify(locs),
                actionType: 'CLICK' as ActionType,
                confidence: 0.9,
                description: `${label} elementine tıklar`
            });
        });

        // 4. Text Assertions
        $('h1, h2, h3, label, span, div, p').each((_, el) => {
            const $el = $(el);
            const text = $el.text().trim();
            if (!text || text.length > 50 || text.length < 2) return;

            const isHeading = ['h1', 'h2', 'h3'].includes(el.tagName.toLowerCase());
            const hasId = !!($el.attr('id') || $el.attr('data-test') || $el.attr('data-testid'));

            if (isHeading || hasId) {
                const locs = getLocators(el);
                if (locs.length === 0) return;

                suggestions.push({
                    name: `"${text.substring(0, 20)}..." Metnini Doğrula`,
                    locator: JSON.stringify(locs),
                    actionType: 'ASSERT_TEXT' as ActionType,
                    confidence: 0.9,
                    description: `"${text}" metninin görünür olduğunu doğrular`
                });
            }
        });

        return suggestions;
    }
}

export const stepSuggestionService = new StepSuggestionService();
