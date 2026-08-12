import fs from 'fs';
import net from 'net';
import path from 'path';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { ResultStatus } from '@prisma/client';
import { createLogger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { SocketService } from './socket.service';

const logger = createLogger('PlaywrightExecutorService');
const latestFrames = new Map<string, { frame: string; updatedAt: number }>();

export const getLatestLiveFrame = (runId: string) => latestFrames.get(runId);
export const clearLatestLiveFrame = (runId: string) => latestFrames.delete(runId);

const publishLiveFrame = (runId: string, frame: Buffer | string) => {
    const buffer = Buffer.isBuffer(frame) ? frame : Buffer.from(frame, 'base64');
    if (buffer.length < 50) return;
    latestFrames.set(runId, { frame: buffer.toString('base64'), updatedAt: Date.now() });
    if (SocketService.isInitialized()) {
        SocketService.getInstance().cacheLiveFrame(runId, buffer);
    } else {
        // Unit-level executor tests can run without the HTTP/socket server.
        // The transport diagnostics still prove that frames were received.
        return;
    }
};

const publishLiveEvent = (runId: string, event: Parameters<SocketService['publishLiveEvent']>[1]) => {
    if (SocketService.isInitialized()) {
        SocketService.getInstance().publishLiveEvent(runId, event);
    }
};

interface LiveStreamDiagnostics {
    connected: boolean;
    frames: number;
    events: number;
}

interface LiveStreamTransport {
    port: number;
    token: string;
    getDiagnostics: () => LiveStreamDiagnostics;
    close: () => Promise<void>;
}

const MAX_LIVE_PACKET_BYTES = 12 * 1024 * 1024;

/**
 * A loopback-only, authenticated binary transport between the generated
 * Playwright process and the API process. The browser never gets an external
 * endpoint and frames never pass through stdout/base64 logs.
 *
 * Packet format: [1 byte type][4 byte big-endian length][payload]
 * type 0 = JSON control/event packet, type 1 = JPEG screencast frame.
 */
const createLiveStreamTransport = async (runId: string): Promise<LiveStreamTransport> => {
    const token = randomUUID();
    const server = net.createServer();
    const sockets = new Set<net.Socket>();
    const diagnostics: LiveStreamDiagnostics = { connected: false, frames: 0, events: 0 };

    server.on('connection', (socket) => {
        sockets.add(socket);
        let authenticated = false;
        let pending = Buffer.alloc(0);

        const rejectSocket = () => {
            socket.destroy();
            sockets.delete(socket);
        };

        socket.on('data', (chunk) => {
            pending = Buffer.concat([pending, chunk]);
            if (pending.length > MAX_LIVE_PACKET_BYTES * 2) {
                rejectSocket();
                return;
            }

            while (pending.length >= 5) {
                const type = pending.readUInt8(0);
                const length = pending.readUInt32BE(1);
                if (length > MAX_LIVE_PACKET_BYTES) {
                    rejectSocket();
                    return;
                }
                if (pending.length < 5 + length) return;

                const payload = pending.subarray(5, 5 + length);
                pending = pending.subarray(5 + length);

                if (!authenticated) {
                    if (type !== 0) {
                        rejectSocket();
                        return;
                    }
                    try {
                        const hello = JSON.parse(payload.toString('utf8')) as { kind?: string; token?: string };
                        if (hello.kind !== 'hello' || hello.token !== token) {
                            rejectSocket();
                            return;
                        }
                        authenticated = true;
                        diagnostics.connected = true;
                        publishLiveEvent(runId, { type: 'stream:status', status: 'connected' });
                    } catch {
                        rejectSocket();
                        return;
                    }
                    continue;
                }

                if (type === 1) {
                    diagnostics.frames++;
                    publishLiveFrame(runId, payload);
                    continue;
                }

                if (type === 0) {
                    try {
                        const message = JSON.parse(payload.toString('utf8')) as { kind?: string; event?: Parameters<SocketService['publishLiveEvent']>[1] };
                        if (message.kind === 'event' && message.event) {
                            diagnostics.events++;
                            publishLiveEvent(runId, message.event);
                        }
                    } catch {
                        // Ignore malformed telemetry; the browser run remains authoritative.
                    }
                }
            }
        });

        socket.on('close', () => {
            sockets.delete(socket);
        });
        socket.on('error', () => {
            sockets.delete(socket);
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.removeListener('error', reject);
            resolve();
        });
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        throw new Error('Live stream transport failed to acquire a loopback port');
    }

    return {
        port: address.port,
        token,
        getDiagnostics: () => ({ ...diagnostics }),
        close: async () => {
            for (const socket of sockets) socket.destroy();
            await new Promise<void>((resolve) => {
                if (!server.listening) {
                    resolve();
                    return;
                }
                server.close(() => resolve());
            });
        },
    };
};

const execAsync = (file: string, args: string[], options: any, runId?: string): Promise<{ stdout: string; stderr: string }> => {
    return new Promise((resolve, reject) => {
        // Never invoke a shell for generated automation. Even though the
        // executable and arguments are server-created, shell execution turns
        // a future quoting regression into command injection.
        const child = spawn(file, args, {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            // Put the shell and Playwright descendants in their own process
            // group so a timeout can terminate the complete browser tree.
            detached: true,
        });

        let stdoutStr = '';
        let stderrStr = '';
        let lineBuffer = '';

        const publishScreenshotLine = (rawLine: string) => {
            if (!runId) return;
            const cleanLine = rawLine.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
            const markerIndex = cleanLine.indexOf('__SCREENSHOT__:');
            if (markerIndex === -1) return;
            const base64 = cleanLine.slice(markerIndex + '__SCREENSHOT__:'.length).replace(/[^a-zA-Z0-9+/=]/g, '');
            if (base64.length > 50) {
                try {
                    publishLiveFrame(runId, base64);
                } catch (e) {
                    logger.error('Failed to emit live frame over socket:', e);
                }
            }
        };

        if (child.stdout) {
            child.stdout.on('data', (data) => {
                const chunk = data.toString();
                if (stdoutStr.length < 10 * 1024 * 1024) stdoutStr += chunk.slice(0, 10 * 1024 * 1024 - stdoutStr.length);

                if (runId) {
                    lineBuffer += chunk;
                    const lines = lineBuffer.split('\n');
                    lineBuffer = lines.pop() || '';

                    for (const rawLine of lines) publishScreenshotLine(rawLine);
                }
            });
        }

        if (child.stderr) {
            child.stderr.on('data', (data) => {
                const chunk = data.toString();
                if (stderrStr.length < 10 * 1024 * 1024) stderrStr += chunk.slice(0, 10 * 1024 * 1024 - stderrStr.length);
            });
        }

        let settled = false;
        const timeoutMs = options.timeoutMs || 90_000;
        const terminateProcessGroup = () => {
            if (!child.pid) return;
            try {
                process.kill(-child.pid, 'SIGTERM');
            } catch {
                try { child.kill('SIGTERM'); } catch { /* already exited */ }
            }
            setTimeout(() => {
                try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* already exited */ }
            }, 2_000).unref();
        };
        const timeout = setTimeout(() => {
            if (settled) return;
            terminateProcessGroup();
            const error = new Error(`Playwright execution timed out after ${timeoutMs}ms`) as any;
            error.code = 'ETIMEDOUT';
            error.stdout = stdoutStr;
            error.stderr = stderrStr;
            settled = true;
            reject(error);
        }, timeoutMs);

        child.on('error', (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            (error as any).stdout = stdoutStr;
            (error as any).stderr = stderrStr;
            reject(error);
        });

        child.on('close', (code) => {
            // Playwright may terminate without a trailing newline. Process the
            // final buffered frame before resolving the execution.
            publishScreenshotLine(lineBuffer);
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (code !== 0 && code !== null) {
                const error = new Error(`Playwright process exited with code ${code}`) as any;
                error.stdout = stdoutStr;
                error.stderr = stderrStr;
                reject(error);
            } else {
                resolve({ stdout: stdoutStr, stderr: stderrStr });
            }
        });
    });
};

export interface StepExecutionResult {
    name: string;
    status: 'passed' | 'failed' | 'skipped' | 'timedOut';
    duration: number;
    error?: string;
}

export interface ExecutionResult {
    status: ResultStatus;
    duration: number;
    logs: string;
    steps?: StepExecutionResult[];
    screenshotUrl?: string;
    traceUrl?: string;
    videoUrl?: string;
    liveStream?: LiveStreamDiagnostics;
}

export class PlaywrightExecutorService {
    private tempDir = path.join(process.cwd(), 'automation-runtime');
    private activeExecutions = 0;
    private readonly maxConcurrency = Math.min(16, Math.max(1, parseInt(process.env.MAX_PLAYWRIGHT_CONCURRENCY || '4', 10) || 4));

    constructor() {
        this.ensureTempDir();
    }

    private async ensureTempDir() {
        try {
            await fs.promises.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            logger.error('Failed to create temp dir:', error);
        }
    }

    private async processVideoArtifact(videoPath: string, runId: string): Promise<string | undefined> {
        try {
            let retries = 5;
            let fileReady = false;

            while (retries > 0 && !fileReady) {
                const stats = await fs.promises.stat(videoPath).catch(() => null);
                if (stats && stats.size > 0) {
                    fileReady = true;
                } else {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    retries--;
                }
            }

            if (!fileReady) {
                logger.warn('Video file not ready or empty after retries:', videoPath);
                return undefined;
            }

            // Dry-run recordings are short-lived and ownership-checked by the
            // automation service. Persist them behind the backend proxy so a
            // private MinIO hostname never leaks into a browser-facing URL.
            const videoFileName = `video-${runId}.webm`;
            const publicVideoDir = path.join(process.cwd(), 'public', 'videos');
            await fs.promises.mkdir(publicVideoDir, { recursive: true });
            const publicVideoPath = path.join(publicVideoDir, videoFileName);

            await fs.promises.copyFile(videoPath, publicVideoPath);
            return `/public/videos/${videoFileName}`;
        } catch (error) {
            logger.error('Failed to process video artifact:', error);
        }
        return undefined;
    }

    private async findVideoInTestResults(runDir: string, runId: string): Promise<string | undefined> {
        try {
            const findWebm = async (dir: string): Promise<string | undefined> => {
                try {
                    const files = await fs.promises.readdir(dir, { withFileTypes: true });
                    for (const file of files) {
                        const resPath = path.join(dir, file.name);
                        if (file.isDirectory()) {
                            const found = await findWebm(resPath);
                            if (found) return found;
                        } else if (file.name.endsWith('.webm')) {
                            return resPath;
                        }
                    }
                } catch (e) {
                    // Ignore directory read errors
                }
                return undefined;
            };

            const videoPath = await findWebm(runDir);
            if (videoPath) {
                return await this.processVideoArtifact(videoPath, runId);
            }
        } catch (error) {
            logger.error('Failed to find video in test results:', error);
        }
        return undefined;
    }

    private parseReport(stdout: string): any {
        try {
            const jsonMatch = stdout.match(/\{[\s\S]*"suites":[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            logger.warn('Failed to parse Playwright JSON report', e);
        }
        return null;
    }

    async execute(script: string, runId: string, options: { headless?: boolean; projectId?: string } = {}): Promise<ExecutionResult> {
        if (typeof script !== 'string' || Buffer.byteLength(script, 'utf8') > 2 * 1024 * 1024) {
            throw new AppError('Generated automation script is too large', 400);
        }
        if (this.activeExecutions >= this.maxConcurrency) {
            throw new AppError(`Maximum concurrent Playwright automation limit (${this.maxConcurrency}) reached. Please try again shortly.`, 429);
        }

        this.activeExecutions++;
        await this.ensureTempDir();
        const safeRunId = String(runId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100) || `run-${Date.now()}`;
        const runDir = path.join(this.tempDir, `run-${safeRunId}-${Date.now()}`);
        await fs.promises.mkdir(runDir, { recursive: true });

        const fileName = `test-${safeRunId}.spec.ts`;
        const filePath = path.join(runDir, fileName);
        const jsonReportPath = path.join(runDir, 'report.json');
        let liveStream: LiveStreamTransport | undefined;
        let liveStreamDiagnostics: LiveStreamDiagnostics | undefined;

        try {
            await fs.promises.writeFile(filePath, script);
            liveStream = await createLiveStreamTransport(runId);
            if (SocketService.isInitialized()) {
                SocketService.getInstance().registerLiveRun(runId, options.projectId);
            }

            const startTime = Date.now();
            const headlessFlag = options.headless === false ? '--headed' : '';
            // Use the project-local Playwright binary directly. Spawning via
            // `npx` can leave an npm wrapper alive and make the browser worker
            // look hung under concurrent executions.
            const playwrightBin = path.join(process.cwd(), 'node_modules', '.bin', 'playwright');
            const playwrightArgs = [
                'test',
                filePath,
                '--reporter=line',
                '--workers=1',
                ...(headlessFlag ? [headlessFlag] : []),
                `--output=${path.join(runDir, 'test-results')}`,
            ];

            let runError: any = null;
            let stdout = '';
            let stderr = '';

            try {
                const result = await execAsync(playwrightBin, playwrightArgs, {
                    cwd: process.cwd(),
                    maxBuffer: 50 * 1024 * 1024,
                    env: {
                        ...process.env,
                        PLAYWRIGHT_JSON_OUTPUT_NAME: jsonReportPath,
                        LIVE_STREAM_PORT: String(liveStream.port),
                        LIVE_STREAM_TOKEN: liveStream.token,
                    },
                    timeoutMs: Math.min(300_000, Math.max(10_000, parseInt(process.env.PLAYWRIGHT_EXECUTION_TIMEOUT_MS || '90000', 10) || 90_000)),
                }, runId);
                stdout = result.stdout;
                stderr = result.stderr;
            } catch (error: any) {
                runError = error;
                stdout = error.stdout || '';
                stderr = error.stderr || '';
            }

            liveStreamDiagnostics = liveStream.getDiagnostics();

            const duration = runError ? 0 : Date.now() - startTime;
            let steps: StepExecutionResult[] = [];
            let status: ResultStatus = runError ? ResultStatus.FAIL : ResultStatus.PASS;
            let videoUrl: string | undefined;

            // Try reading the JSON report from the output file first
            let report: any = null;
            try {
                if (fs.existsSync(jsonReportPath)) {
                    const reportContent = await fs.promises.readFile(jsonReportPath, 'utf8');
                    report = JSON.parse(reportContent);
                }
            } catch (e) {
                logger.warn('Failed to read JSON report from file, falling back to stdout parsing', e);
            }

            // Fallback to regex parsing if report was not loaded
            if (!report && stdout) {
                report = this.parseReport(stdout);
            }

            if (report) {
                const testResult = report.suites?.[0]?.specs?.[0]?.tests?.[0]?.results?.[0];
                if (testResult) {
                    if (testResult.status !== 'passed') {
                        status = ResultStatus.FAIL;
                    }

                    if (testResult.steps) {
                        steps = testResult.steps.map((s: any) => ({
                            name: s.title,
                            status: s.error ? 'failed' : 'passed',
                            duration: s.duration,
                            error: s.error?.message
                        }));
                    }

                    const videoPath = testResult.attachments?.find((a: any) => a.name === 'video')?.path;
                    if (videoPath && fs.existsSync(videoPath)) {
                        videoUrl = await this.processVideoArtifact(videoPath, runId);
                    }
                }
            }

            if (!videoUrl) {
                videoUrl = await this.findVideoInTestResults(runDir, runId);
            }

            if (runError && status === ResultStatus.PASS) {
                status = ResultStatus.FAIL;
            }

            return {
                status,
                duration: duration || (runError ? 0 : 1),
                logs: stdout || stderr || (runError ? runError.message : ''),
                steps,
                videoUrl,
                liveStream: liveStreamDiagnostics,
            };

        } catch (error: any) {
            return {
                status: ResultStatus.FAIL,
                duration: 0,
                logs: error.stdout || error.stderr || error.message,
                steps: [],
                videoUrl: undefined,
                liveStream: liveStreamDiagnostics,
            };
        } finally {
            if (liveStream) {
                liveStreamDiagnostics = liveStream.getDiagnostics();
                await liveStream.close().catch((error) => logger.warn('Failed to close live stream transport:', error));
            }
            if (SocketService.isInitialized()) {
                SocketService.getInstance().unregisterLiveRun(runId);
            }
            clearLatestLiveFrame(runId);
            this.activeExecutions--;
            try {
                if (fs.existsSync(runDir)) {
                    await fs.promises.rm(runDir, { recursive: true, force: true });
                }
            } catch (e) {
                logger.warn(`Failed to delete temp run directory ${runDir}`, e);
            }
        }
    }
}

export const playwrightExecutorService = new PlaywrightExecutorService();
