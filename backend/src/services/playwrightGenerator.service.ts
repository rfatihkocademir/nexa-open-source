import { TestStep } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const escapeStr = (str: string | null | undefined): string => {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\${/g, '\\${');
};

const sanitizeKey = (key: string | null | undefined): string => {
    if (!key) return '';
    return key.replace(/[^a-zA-Z0-9_.-]/g, '');
};

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']);

const normalizeHttpMethod = (value: unknown): string => {
    const method = String(value || 'GET').trim().toUpperCase();
    if (!HTTP_METHODS.has(method)) {
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
    return method;
};

const boundedInteger = (value: unknown, fallback: number, min: number, max: number): number => {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
};

export class PlaywrightGeneratorService {
    generateScript(steps: TestStep[], variables: Record<string, string> = {}, options: { headless?: boolean } = {}): string {
        // Detect Base URL from variables
        let baseUrl = variables.BASE_URL || variables.base_url || variables.baseUrl;
        
        // Normalize Base URL (Add protocol if missing)
        if (baseUrl && !baseUrl.startsWith('http')) {
            baseUrl = `http://${baseUrl}`;
        }

        const headless = options.headless !== false;
        let slowMoVal = headless ? 0 : 1000;
        if (variables.SLOW_MO !== undefined) {
            slowMoVal = boundedInteger(variables.SLOW_MO, slowMoVal, 0, 5000);
        }

        const safeVars = JSON.stringify(variables);
        const compiledFixturePath = path.join(process.cwd(), 'dist/services/automationTest.fixtures.js');
        const sourceFixturePath = path.join(process.cwd(), 'src/services/automationTest.fixtures.ts');
        const fixtureModulePath = fs.existsSync(compiledFixturePath) ? compiledFixturePath : sourceFixturePath;

        const lines: string[] = [
            `import { test, expect, request } from ${JSON.stringify(fixtureModulePath)};`,
            "import net from 'node:net';",
            "",
            "test.use({",
            "    video: 'on',",
            `    baseURL: ${baseUrl ? JSON.stringify(baseUrl) : "undefined"},`,
            `    locale: ${variables.LOCALE ? JSON.stringify(variables.LOCALE) : "undefined"},`,
            `    timezoneId: ${variables.TIMEZONE ? JSON.stringify(variables.TIMEZONE) : "undefined"},`,
            "    launchOptions: {",
            `        slowMo: ${slowMoVal}`,
            "    },",
            "});",
            "",
            "test('Generated Scenario', async ({ page, context, request }) => {",
            "    console.log('Test started');",
            "    // Initialize runtime variables",
            `    const vars: Record<string, any> = ${safeVars};`,
            "",
            "    // Set default timeout",
            "    test.setTimeout(60000);",
            "    const visualDelay = Math.min(5000, Math.max(0, Number(vars['LIVE_STEP_DELAY'] ?? 700)));",
            "    const liveStreamPort = Number(process.env.LIVE_STREAM_PORT || 0);",
            "    const liveStreamToken = process.env.LIVE_STREAM_TOKEN || '';",
            "    const liveTransport = liveStreamPort && liveStreamToken ? net.createConnection({ host: '127.0.0.1', port: liveStreamPort }) : null;",
            "    let liveTransportReady = false;",
            "    let screencastSession: any;",
            "    const sendLivePacket = (type: number, payload: Buffer) => {",
            "        if (!liveTransport || !liveTransportReady || liveTransport.destroyed) return;",
            "        // Drop video frames when the local IPC buffer is backlogged; never block the test.",
            "        if (type === 1 && liveTransport.writableLength > 4 * 1024 * 1024) return;",
            "        const packet = Buffer.allocUnsafe(5 + payload.length);",
            "        packet.writeUInt8(type, 0);",
            "        packet.writeUInt32BE(payload.length, 1);",
            "        payload.copy(packet, 5);",
            "        liveTransport.write(packet);",
            "    };",
            "    const emitLiveEvent = (event: any) => sendLivePacket(0, Buffer.from(JSON.stringify({ kind: 'event', event })));",
            "    if (liveTransport) {",
            "        liveTransport.on('connect', () => {",
            "            liveTransportReady = true;",
            "            sendLivePacket(0, Buffer.from(JSON.stringify({ kind: 'hello', token: liveStreamToken })));",
            "        });",
            "        liveTransport.on('error', () => { liveTransportReady = false; });",
            "        liveTransport.on('close', () => { liveTransportReady = false; });",
            "    }",
            "    const startLiveScreencast = async () => {",
            "        if (!liveTransport) return;",
            "        try {",
            "            screencastSession = await context.newCDPSession(page);",
            "            screencastSession.on('Page.screencastFrame', async (payload: any) => {",
            "                try { sendLivePacket(1, Buffer.from(payload.data, 'base64')); }",
            "                finally { await screencastSession.send('Page.screencastFrameAck', { sessionId: payload.sessionId }).catch(() => undefined); }",
            "            });",
            "            await screencastSession.send('Page.startScreencast', { format: 'jpeg', quality: 78, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });",
            "            emitLiveEvent({ type: 'stream:status', status: 'running' });",
            "        } catch (error) {",
            "            console.error('Live screencast unavailable:', error instanceof Error ? error.message : String(error));",
            "        }",
            "    };",
            "    const updateLivePointer = async (details: { x?: number; y?: number; label?: string; box?: { x: number; y: number; width: number; height: number } | null }) => {",
            "        await page.evaluate((input) => {",
            "            const root = document.body || document.documentElement;",
            "            const ensure = (id: string, styles: Record<string, string>) => {",
            "                let node = document.getElementById(id) as HTMLDivElement | null;",
            "                if (!node) { node = document.createElement('div'); node.id = id; root.appendChild(node); }",
            "                Object.assign(node.style, styles);",
            "                return node;",
            "            };",
            "            const x = typeof input.x === 'number' ? input.x : undefined;",
            "            const y = typeof input.y === 'number' ? input.y : undefined;",
            "            const arrow = ensure('__nexa_live_pointer_arrow', { position: 'fixed', zIndex: '2147483647', width: '27px', height: '33px', background: '#ffffff', clipPath: 'polygon(0 0, 0 100%, 31% 71%, 48% 100%, 61% 93%, 44% 64%, 100% 64%)', filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.6))', pointerEvents: 'none', transform: 'translate(-3px,-3px)', transition: 'left .16s ease, top .16s ease' });",
            "            const label = ensure('__nexa_live_pointer_label', { position: 'fixed', zIndex: '2147483647', maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '6px 10px', border: '1px solid rgba(165,180,252,.7)', borderRadius: '7px', background: 'rgba(15,23,42,.94)', color: '#ffffff', font: '600 12px ui-sans-serif,system-ui,sans-serif', boxShadow: '0 5px 18px rgba(0,0,0,.42)', pointerEvents: 'none', transition: 'left .16s ease, top .16s ease' });",
            "            const highlight = ensure('__nexa_live_pointer_highlight', { position: 'fixed', zIndex: '2147483644', border: '2px solid #818cf8', borderRadius: '8px', boxShadow: '0 0 0 3px rgba(99,102,241,.28)', pointerEvents: 'none', transition: 'left .16s ease, top .16s ease, width .16s ease, height .16s ease' });",
            "            if (typeof x === 'number' && typeof y === 'number') {",
            "                arrow.style.left = x + 'px'; arrow.style.top = y + 'px';",
            "                label.style.left = Math.min(Math.max(8, x + 20), Math.max(8, window.innerWidth - 368)) + 'px';",
            "                label.style.top = Math.min(Math.max(8, y + 18), Math.max(8, window.innerHeight - 42)) + 'px';",
            "            }",
            "            label.textContent = input.label || ''; label.style.display = input.label ? 'block' : 'none';",
            "            if (input.box) {",
            "                highlight.style.display = 'block'; highlight.style.left = (input.box.x - 6) + 'px'; highlight.style.top = (input.box.y - 6) + 'px'; highlight.style.width = (input.box.width + 12) + 'px'; highlight.style.height = (input.box.height + 12) + 'px';",
            "            } else { highlight.style.display = 'none'; }",
            "        }, details).catch(() => undefined);",
            "    };",
            "",
            "    try {",
            "        await startLiveScreencast();",
            "",
            baseUrl ? "        console.log('Performing implicit initial navigation to baseURL');" : "",
            baseUrl ? "        await page.goto('/');" : "",
            "        const initialPointer = await page.evaluate(() => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }));",
            "        await updateLivePointer({ ...initialPointer, label: 'Dry run hazırlanıyor' });",
            ""
        ];

        for (const [stepIndex, step] of steps.entries()) {
            const { actionType, locator, data } = step;

            // Helper to generate variable lookup code safely
            const resolve = (text: string | null): string => {
                if (!text) return '';
                const parts = text.split(/(\{\{[^}]+\}\})/g);
                return parts.map(part => {
                    const match = part.match(/^\{\{([^}]+)\}\}$/);
                    if (match) {
                        const key = sanitizeKey(match[1].trim());
                        return `\${vars['${key}'] ?? ''}`;
                    }
                    return escapeStr(part);
                }).join('');
            };

            // Helper to generate a Playwright locator string (with support for fallbacks)
            const getLocatorCode = (rawLocator: string | null): string => {
                if (!rawLocator) return 'page';
                
                try {
                    const parsed = JSON.parse(rawLocator);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        // Chain locators using .or()
                        return parsed
                            .map(loc => `page.locator(\`${resolve(loc)}\`)`)
                            .join('.or(') + ')'.repeat(parsed.length - 1) + '.first()';
                    }
                } catch (e) {
                    // Not a JSON array, treat as single selector
                }
                
                // Fallback selectors are commonly broad CSS unions. Use the
                // first matching element to avoid Playwright strict-mode
                // failures (for example submit + SSO buttons on login).
                return `page.locator(\`${resolve(rawLocator)}\`).first()`;
            };

            const safeStepName = escapeStr(step.name || 'Unnamed Step');
            lines.push(`    await test.step(\`${safeStepName}\`, async () => {`);
            lines.push(`        console.log('Executing step:', ${JSON.stringify(step.name)});`);
            lines.push(`        emitLiveEvent({ type: 'step:start', stepIndex: ${stepIndex}, name: ${JSON.stringify(step.name || 'Unnamed Step')}, status: 'running' });`);
            lines.push(`        emitLiveEvent({ type: 'action', stepIndex: ${stepIndex}, name: ${JSON.stringify(step.name || 'Unnamed Step')}, actionType: ${JSON.stringify(actionType || 'UNKNOWN')} });`);
            lines.push(`        const liveStepLabel = ${JSON.stringify(`Adım ${stepIndex + 1} · ${step.name || 'Unnamed Step'}`)};`);
            lines.push(`        await updateLivePointer({ label: liveStepLabel });`);
            lines.push(`        let liveStepError: string | undefined;`);
            lines.push(`        try {`);

            const loc = getLocatorCode(locator);

            lines.push(`        let livePointerPosition: { x: number; y: number; box: { x: number; y: number; width: number; height: number } } | null = null;`);
            lines.push(`        const movePointer = async () => {`);
            lines.push(`            try {`);
            lines.push(`                await (${loc}).scrollIntoViewIfNeeded().catch(() => undefined);`);
            lines.push(`                const box = await (${loc}).boundingBox();`);
            lines.push(`                if (box) {`);
            lines.push(`                    const x = box.x + box.width / 2; const y = box.y + box.height / 2;`);
            lines.push(`                    await page.mouse.move(x, y);`);
            lines.push(`                    livePointerPosition = { x, y, box };`);
            lines.push(`                    await updateLivePointer({ x, y, box, label: liveStepLabel });`);
            lines.push(`                    const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));`);
            lines.push(`                    emitLiveEvent({ type: 'pointer', stepIndex: ${stepIndex}, name: ${JSON.stringify(step.name || 'Unnamed Step')}, actionType: ${JSON.stringify(actionType || 'UNKNOWN')}, x, y, viewportWidth: viewport.width, viewportHeight: viewport.height });`);
            lines.push(`                    await page.waitForTimeout(visualDelay);`);
            lines.push(`                }`);
            lines.push(`            } catch { /* pointer guidance must never fail the test */ }`);
            lines.push(`        };`);
            lines.push(`        const refreshLivePointer = async () => { if (livePointerPosition) await updateLivePointer({ ...livePointerPosition, label: liveStepLabel }); };`);

            switch (actionType) {
                case 'NAVIGATE':
                case 'GOTO':
                    let navUrl = [data, locator].find(v => v && v !== 'page') || '';
                    if (!navUrl || navUrl === '/') {
                        navUrl = '/';
                    }
                    const resolvedNavigationUrl = resolve(navUrl);
                    lines.push(`        const navigationUrl = \`${resolvedNavigationUrl}\`;`);
                    lines.push(`        await page.goto(navigationUrl.startsWith('http://') || navigationUrl.startsWith('https://') || navigationUrl.startsWith('/') || navigationUrl.startsWith('data:') || navigationUrl.startsWith('about:') ? navigationUrl : \`https://\${navigationUrl}\`);`);
                    lines.push(`        const navigationPointer = await page.evaluate(() => ({ x: window.innerWidth / 2, y: window.innerHeight / 2, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight }));`);
                    lines.push(`        await updateLivePointer({ x: navigationPointer.x, y: navigationPointer.y, label: liveStepLabel });`);
                    lines.push(`        emitLiveEvent({ type: 'pointer', stepIndex: ${stepIndex}, name: ${JSON.stringify(step.name || 'Unnamed Step')}, actionType: ${JSON.stringify(actionType || 'NAVIGATE')}, x: navigationPointer.x, y: navigationPointer.y, viewportWidth: navigationPointer.viewportWidth, viewportHeight: navigationPointer.viewportHeight });`);
                    break;

                case 'CLICK':
                    lines.push(`        await movePointer();`);
                    lines.push(`        await ${loc}.click();`);
                    // Allow SPA navigation/auth state to settle before the
                    // next generated assertion or interaction.
                    lines.push(`        await page.waitForTimeout(visualDelay);`);
                    lines.push(`        await refreshLivePointer();`);
                    break;

                case 'FILL':
                    lines.push(`        await movePointer();`);
                    lines.push(`        await ${loc}.fill(\`${resolve(data)}\`);`);
                    lines.push(`        await page.waitForTimeout(visualDelay);`);
                    lines.push(`        await refreshLivePointer();`);
                    break;

                case 'ASSERT_TEXT':
                    lines.push(`        await movePointer();`);
                    lines.push(`        await expect(${loc}).toContainText(\`${resolve(data)}\`);`);
                    lines.push(`        await page.waitForTimeout(visualDelay);`);
                    lines.push(`        await refreshLivePointer();`);
                    break;

                case 'ASSERT':
                case 'ASSERT_VISIBLE':
                    lines.push(`        await movePointer();`);
                    lines.push(`        await expect(${loc}).toBeVisible();`);
                    lines.push(`        await page.waitForTimeout(visualDelay);`);
                    lines.push(`        await refreshLivePointer();`);
                    break;

                case 'EXTRACT':
                    lines.push(`        const extractedText = await ${loc}.innerText();`);
                    lines.push(`        console.log('Extracted text:', extractedText);`);
                    break;

                case 'WAIT':
                    const timeout = boundedInteger(data, 1000, 0, 30000);
                    lines.push(`        await page.waitForTimeout(${timeout});`);
                    break;

                case 'SELECT':
                    lines.push(`        await movePointer();`);
                    lines.push(`        await ${loc}.selectOption(\`${resolve(data)}\`);`);
                    lines.push(`        await page.waitForTimeout(visualDelay);`);
                    lines.push(`        await refreshLivePointer();`);
                    break;

                case 'SET_COOKIE':
                    const cookieName = sanitizeKey(step.name);
                    const cookieValue = resolve(data);
                    const domain = resolve(locator) || 'localhost';

                    lines.push(`        await context.addCookies([{
                        name: '${cookieName}',
                        value: \`${cookieValue}\`,
                        domain: \`${domain}\`,
                        path: '/'
                    }]);`);
                    break;

                case 'SET_LOCAL_STORAGE':
                    const lsKey = sanitizeKey(step.name);
                    const lsValue = resolve(data);

                    lines.push(`        await page.evaluate(({ key, value }) => {
                        localStorage.setItem(key, value);
                    }, { key: '${lsKey}', value: \`${lsValue}\` });`);
                    break;

                case 'API_REQUEST':
                    try {
                        const config = JSON.parse(data || '{}');
                        const method = normalizeHttpMethod(config.method);
                        const body = config.body ? JSON.stringify(config.body) : undefined;
                        const outputVar = config.outputVar ? sanitizeKey(config.outputVar) : null;
                        const responsePath = config.responsePath;
                        const targetType = config.targetType;
                        const targetKey = config.targetKey ? sanitizeKey(config.targetKey) : null;
                        const targetDomain = resolve(config.targetDomain) || 'localhost';
                        const resolvedApiUrl = resolve(locator || config.url);

                        lines.push(`        // API Request Step`);
                        lines.push(`        const apiRequestUrl = \`${resolvedApiUrl}\`;`);
                        lines.push(`        const apiResponse = await request.fetch(apiRequestUrl.startsWith('http://') || apiRequestUrl.startsWith('https://') ? apiRequestUrl : \`http://\${apiRequestUrl}\`, {`);
                        // Always serialize generated literals. User supplied
                        // step data must never be able to break out of the
                        // generated source file.
                        lines.push(`            method: ${JSON.stringify(method)},`);
                        if (body) {
                            lines.push(`            data: ${body},`);
                            lines.push(`            headers: { 'Content-Type': 'application/json' }`);
                        }
                        lines.push(`        });`);
                        lines.push(`        `);
                        lines.push(`        if (!apiResponse.ok()) {`);
                        lines.push(`            console.error(\`API Request Failed: \${apiResponse.status()} \${apiResponse.statusText()}\`);`);
                        lines.push(`            const text = await apiResponse.text();`);
                        lines.push(`            console.error(\`Response Body: \${text}\`);`);
                        let errorMsg = `API Request failed with status \${apiResponse.status()} \${apiResponse.statusText()}`;
                        lines.push(`            throw new Error(\`${errorMsg}\`);`);
                        lines.push(`        }`);
                        lines.push(`        `);
                        lines.push(`        let apiJson;`);
                        lines.push(`        try {`);
                        lines.push(`            apiJson = await apiResponse.json();`);
                        lines.push(`        } catch (e) {`);
                        lines.push(`            const text = await apiResponse.text();`);
                        lines.push(`            console.error(\`Failed to parse JSON response: \${text}\`);`);
                        lines.push(`            throw new Error(\`Failed to parse JSON response. See logs for details.\`);`);
                        lines.push(`        }`);

                        const pathParts = responsePath ? responsePath.split('.') : [];
                        const pathAccess = pathParts.map((p: string) => `[${JSON.stringify(p)}]`).join('');
                        const valueExtractionCode = responsePath ? `apiJson${pathAccess}` : `apiJson`;

                        if (outputVar) {
                            lines.push(`        vars['${outputVar}'] = ${valueExtractionCode};`);
                            lines.push(`        console.log('Variable ${outputVar} set to:', vars['${outputVar}']);`);
                        }

                        if (targetType && targetKey) {
                            lines.push(`        const targetValue = ${valueExtractionCode};`);
                            if (targetType === 'COOKIE') {
                                lines.push(`        await context.addCookies([{
                                    name: '${targetKey}',
                                    value: \`\${targetValue}\`,
                                    domain: \`${targetDomain}\`,
                                    path: '/'
                                }]);`);
                            } else if (targetType === 'LOCAL_STORAGE') {
                                lines.push(`        await page.evaluate(({ key, value }) => {
                                    localStorage.setItem(key, value);
                                }, { key: '${targetKey}', value: targetValue });`);
                            }
                        }

                    } catch (e) {
                        lines.push(`        throw new Error(${JSON.stringify(`Failed to generate API request step: ${e instanceof Error ? e.message : String(e)}`)});`);
                    }
                    break;
            }
            lines.push(`        } catch (error) {`);
            lines.push(`            liveStepError = error instanceof Error ? error.message : String(error);`);
            lines.push(`            throw error;`);
            lines.push(`        } finally {`);
            lines.push(`            emitLiveEvent({ type: 'step:end', stepIndex: ${stepIndex}, name: ${JSON.stringify(step.name || 'Unnamed Step')}, status: liveStepError ? 'failed' : 'passed', error: liveStepError });`);
            lines.push(`        }`);
            lines.push(`    });`);
            lines.push("");
        }

        lines.push("    } finally {");
        lines.push("        emitLiveEvent({ type: 'stream:status', status: 'disconnected' });");
        lines.push("        if (screencastSession) await screencastSession.send('Page.stopScreencast').catch(() => undefined);");
        lines.push("        if (liveTransport) await new Promise<void>((resolve) => { liveTransport.end(() => resolve()); setTimeout(resolve, 250); });");
        lines.push("        console.log('Test finished');");
        lines.push("    }");
        lines.push("});");
        return lines.join('\n');
    }
}

export const playwrightGeneratorService = new PlaywrightGeneratorService();
