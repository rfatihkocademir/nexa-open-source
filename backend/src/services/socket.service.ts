import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import Redis from 'ioredis';
import { isRedisAvailable } from './queue/connection';
import { createLogger } from '../utils/logger';

interface JwtPayload {
    id?: string;
    userId: string;
    email: string;
    role: string;
    organizationId?: string;
    sessionId?: string;
    tokenVersion?: number;
    exp?: number;
}

const logger = createLogger('Socket');

const MONITORING_ROOM = 'monitoring';
const liveFrames = new Map<string, { frame: Buffer; expiresAt: number }>();
const LIVE_FRAME_TTL_MS = 30_000;
const MAX_CACHED_LIVE_FRAMES = 100;

export interface LiveRunEvent {
    type: 'step:start' | 'step:end' | 'action' | 'pointer' | 'stream:status';
    stepIndex?: number;
    name?: string;
    actionType?: string;
    status?: 'passed' | 'failed' | 'running' | 'connected' | 'disconnected';
    error?: string;
    x?: number;
    y?: number;
    viewportWidth?: number;
    viewportHeight?: number;
    at?: number;
}

export class SocketService {
    private static instance: SocketService;
    private io: Server;
    private pubClient?: Redis;
    private subClient?: Redis;
    private readonly liveRunProjects = new Map<string, string>();
    private readonly liveRunProjectLookups = new Set<string>();

    constructor(httpServer: HttpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: (process.env.FRONTEND_URL || '').split(',').map(value => value.trim()).filter(Boolean),
                methods: ['GET', 'POST'],
            },
        });

        this.initialize();
        this.initializeRedisAdapter().catch((err) => {
            logger.warn('Redis adapter initialization skipped:', err instanceof Error ? err.message : err);
        });
        SocketService.instance = this;
    }

    private async initializeRedisAdapter() {
        const redisEnabled = await isRedisAvailable();
        if (!redisEnabled) {
            logger.warn('Redis unavailable, continuing with in-memory Socket.IO adapter');
            return;
        }

        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.pubClient = new Redis(redisUrl, { maxRetriesPerRequest: null });
        this.subClient = this.pubClient.duplicate();

        this.io.adapter(createAdapter(this.pubClient, this.subClient));

        this.pubClient.on('error', (err) => logger.error('Redis adapter pub error', err));
        this.subClient.on('error', (err) => logger.error('Redis adapter sub error', err));
    }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            throw new Error('SocketService not initialized');
        }
        return SocketService.instance;
    }

    public static isInitialized(): boolean {
        return Boolean(SocketService.instance);
    }

    private initialize() {
        this.io.on('connection', async (socket: Socket) => {
            logger.info('New client connected:', socket.id);

            // A client can connect just after the first screenshot was emitted.
            // Replay the most recent frame so live sessions do not get stuck on
            // the loading state because of a small connection race.
            socket.on('request-live-frame', (runId: string) => {
                const cached = liveFrames.get(runId);
                if (cached && cached.expiresAt > Date.now()) {
                    const projectId = this.liveRunProjects.get(runId);
                    if (projectId && socket.rooms.has(`project_${projectId}`)) {
                        socket.emit(`test-live-frame-${runId}`, cached.frame);
                    } else if (userId && organizationId) {
                        void prisma.testRun.findFirst({ where: { id: runId, project: { organizationId, ...(userRole === 'ADMIN' ? {} : { members: { some: { userId } } }) } }, select: { id: true } }).then(run => {
                            if (run) socket.emit(`test-live-frame-${runId}`, cached.frame);
                        });
                    }
                } else if (cached) {
                    liveFrames.delete(runId);
                }
            });

            // Extract token from auth handshake for notification rooms
            const token = socket.handshake.auth?.token;
            let userRole: string | null = null;
            let userId: string | null = null;
            let organizationId: string | null = null;
            let decodedToken: JwtPayload | null = null;

            if (token) {
                try {
                    // Verify JWT and extract userId
                    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
                    decodedToken = decoded;
                    userId = decoded.userId || decoded.id || null;
                    userRole = decoded.role;

                    if (userId) {
                        const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, role: true, tokenVersion: true, organizationMemberships: { select: { organizationId: true } } } });
                        const tokenOrganizationId = decoded.organizationId;
                        if (!currentUser?.isActive || !tokenOrganizationId || !currentUser.organizationMemberships.some(m => m.organizationId === tokenOrganizationId)) throw new Error('Invalid socket session');
                        organizationId = tokenOrganizationId;
                        userRole = currentUser.role;
                        logger.info(`Socket ${socket.id} authenticated as user ${userId}`);
                        socket.join(`user_${userId}`);

                        // Fetch all projects user is a member of (or all if ADMIN)
                        let projectIds: string[] = [];

                        if (decoded.role === 'ADMIN') {
                            // Admins can receive notifications from all projects
                            const projects = await prisma.project.findMany({
                                where: { status: 'ACTIVE', organizationId },
                                select: { id: true }
                            });
                            projectIds = projects.map(p => p.id);
                        } else {
                            // Regular users join only their project rooms
                            const memberships = await prisma.projectMember.findMany({
                                where: { userId, project: { organizationId: organizationId! } },
                                select: { projectId: true }
                            });
                            projectIds = memberships.map(m => m.projectId);
                        }

                        // Auto-join all project rooms
                        for (const projectId of projectIds) {
                            socket.join(`project_${projectId}`);
                        }

                        logger.info(`Socket ${socket.id} joined ${projectIds.length} project rooms`);
                    }
                } catch (err: any) {
                    logger.warn(`Socket ${socket.id} token verification failed (${err?.message}), connected unauthenticated`);
                }
            }

            // WebSocket authentication is long-lived. Re-check the session,
            // token version, account state and organization membership so a
            // logout/deactivation/revocation takes effect without waiting for
            // the browser to reconnect.
            let sessionMonitor: NodeJS.Timeout | undefined;
            if (userId && organizationId && decodedToken) {
                sessionMonitor = setInterval(async () => {
                    try {
                        const currentUser = await prisma.user.findUnique({
                            where: { id: userId! },
                            select: {
                                isActive: true,
                                tokenVersion: true,
                                organizationMemberships: { where: { organizationId: organizationId! }, select: { organizationId: true } },
                            },
                        });
                        const session = decodedToken?.sessionId
                            ? await prisma.authSession.findFirst({ where: { id: decodedToken.sessionId, userId: userId!, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } })
                            : null;
                        if (!currentUser?.isActive || !currentUser.organizationMemberships.length ||
                            (decodedToken.tokenVersion !== undefined && currentUser.tokenVersion !== decodedToken.tokenVersion) || !session) {
                            socket.disconnect(true);
                            return;
                        }
                    } catch {
                        // A transient database failure must not turn into a
                        // permission grant; terminate the socket fail-closed.
                        socket.disconnect(true);
                    }
                }, 30_000);
                socket.once('disconnect', () => {
                    if (sessionMonitor) clearInterval(sessionMonitor);
                });
            }

            // Handle manual project room join/leave
            socket.on('join_project', (projectId: string) => {
                if (!userId || !organizationId) return socket.emit('error', { message: 'Authentication required' });
                void prisma.project.findFirst({ where: { id: projectId, organizationId, members: { some: { userId } } }, select: { id: true } }).then(project => {
                    if (!project) return socket.emit('error', { message: 'Unauthorized project' });
                    socket.join(`project_${projectId}`);
                    logger.info(`Socket ${socket.id} joined project_${projectId}`);
                });
            });

            socket.on('leave_project', (projectId: string) => {
                socket.leave(`project_${projectId}`);
                logger.info(`Socket ${socket.id} left project_${projectId}`);
            });

            // Handle monitoring room join
            socket.on('join_monitoring', () => {
                const isLocal = socket.handshake.address === '127.0.0.1' || socket.handshake.address === '::1' || socket.handshake.address === '::ffff:127.0.0.1';
                const isAdmin = userRole === 'ADMIN';

                if (isLocal || isAdmin) {
                    socket.join(MONITORING_ROOM);
                    logger.info(`Socket ${socket.id} joined ${MONITORING_ROOM} (Authorized: ${isLocal ? 'Local' : 'Admin'})`);
                    
                    // Immediately send current snapshot to the new joiner
                    import('./monitoringTelemetry.service').then(({ monitoringTelemetryService }) => {
                        socket.emit('telemetry_snapshot', monitoringTelemetryService.getSnapshot());
                    });
                } else {
                    logger.warn(`Socket ${socket.id} denied access to ${MONITORING_ROOM}`);
                    socket.emit('error', { message: 'Unauthorized access to monitoring room' });
                }
            });

        });
    }

    public registerLiveRun(runId: string, projectId?: string) {
        if (projectId) this.liveRunProjects.set(runId, projectId);
    }

    public unregisterLiveRun(runId: string) {
        this.liveRunProjects.delete(runId);
        this.liveRunProjectLookups.delete(runId);
        liveFrames.delete(runId);
    }

    public cacheLiveFrame(runId: string, frame: Buffer) {
        if (liveFrames.size >= MAX_CACHED_LIVE_FRAMES && !liveFrames.has(runId)) {
            const oldestRunId = liveFrames.keys().next().value;
            if (oldestRunId) liveFrames.delete(oldestRunId);
        }
        liveFrames.delete(runId);
        liveFrames.set(runId, { frame, expiresAt: Date.now() + LIVE_FRAME_TTL_MS });

        const projectId = this.liveRunProjects.get(runId);
        if (projectId) {
            this.io.to(`project_${projectId}`).emit(`test-live-frame-${runId}`, frame);
            return;
        }

        // Test-run automations may not register a project explicitly. Resolve
        // it once per run, never once per video frame.
        if (!this.liveRunProjectLookups.has(runId)) {
            this.liveRunProjectLookups.add(runId);
            void prisma.testRunItem.findUnique({ where: { id: runId }, select: { testRun: { select: { projectId: true } } } }).then(item => {
                if (item?.testRun.projectId) {
                    this.liveRunProjects.set(runId, item.testRun.projectId);
                    const latest = liveFrames.get(runId);
                    if (latest && latest.expiresAt > Date.now()) {
                        this.io.to(`project_${item.testRun.projectId}`).emit(`test-live-frame-${runId}`, latest.frame);
                    }
                }
            }).catch(() => {
                // A missing persisted test-run must not break the browser job.
            });
        }
    }

    public publishLiveEvent(runId: string, event: LiveRunEvent) {
        const projectId = this.liveRunProjects.get(runId);
        if (projectId) {
            this.io.to(`project_${projectId}`).emit(`test-live-event-${runId}`, { ...event, at: event.at || Date.now() });
            return;
        }

        if (!this.liveRunProjectLookups.has(runId)) {
            this.liveRunProjectLookups.add(runId);
            void prisma.testRunItem.findUnique({ where: { id: runId }, select: { testRun: { select: { projectId: true } } } }).then(item => {
                if (item?.testRun.projectId) {
                    this.liveRunProjects.set(runId, item.testRun.projectId);
                    this.io.to(`project_${item.testRun.projectId}`).emit(`test-live-event-${runId}`, { ...event, at: event.at || Date.now() });
                }
            }).catch(() => {
                // The execution result remains authoritative if the run has no DB scope.
            });
        }
    }

    public emitToSocket(socketId: string, event: string, data: any) {
        this.io.to(socketId).emit(event, data);
    }

    public getIO(): Server {
        return this.io;
    }

    // Notification methods - emit to rooms
    public notifyProject(projectId: string, payload: any) {
        this.io.to(`project_${projectId}`).emit('notification', payload);
        logger.info(`Notification sent to project_${projectId}: ${payload.title}`);
    }

    public notifyUser(userId: string, payload: any) {
        this.io.to(`user_${userId}`).emit('notification', payload);
        logger.info(`Notification sent to user_${userId}: ${payload.title}`);
    }

    public broadcastProjectEvent(projectId: string, event: string, payload: any) {
        this.io.to(`project_${projectId}`).emit(event, payload);
        logger.info(`Broadcasted ${event} to project_${projectId}`);
    }
}
