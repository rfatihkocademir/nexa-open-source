import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from './utils/logger';
import jwt from 'jsonwebtoken';
import prisma from './utils/prisma';

let io: Server;

interface JwtPayload {
    id?: string;
    userId?: string;
    role: string;
}

export const initSocket = (httpServer: HttpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', async (socket: Socket) => {
        logger.info(`Client connected: ${socket.id}`);

        // Extract token from auth handshake
        const token = socket.handshake.auth?.token;

        if (token) {
            try {
                // Verify JWT and extract userId
                const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
                const userId = decoded.userId || decoded.id;

                if (!userId) {
                    throw new Error('JWT payload is missing user identifier');
                }

                logger.info(`Socket ${socket.id} authenticated as user ${userId}`);

                // Join user-specific room for direct notifications
                socket.join(`user_${userId}`);
                logger.info(`Socket ${socket.id} joined user_${userId}`);

                // Fetch all projects user is a member of (or all if ADMIN)
                let projectIds: string[] = [];

                if (decoded.role === 'ADMIN') {
                    // Admins can receive notifications from all projects
                    const projects = await prisma.project.findMany({
                        where: { status: 'ACTIVE' },
                        select: { id: true }
                    });
                    projectIds = projects.map(p => p.id);
                } else {
                    // Regular users join only their project rooms
                    const memberships = await prisma.projectMember.findMany({
                        where: { userId },
                        select: { projectId: true }
                    });
                    projectIds = memberships.map(m => m.projectId);
                }

                // Auto-join all project rooms
                for (const projectId of projectIds) {
                    socket.join(`project_${projectId}`);
                    logger.info(`Socket ${socket.id} auto-joined project_${projectId}`);
                }

                logger.info(`Socket ${socket.id} joined ${projectIds.length} project rooms`);

            } catch (err) {
                logger.warn(`Socket ${socket.id} failed to authenticate: ${err}`);
            }
        }

        // Manual join/leave for dynamic room management
        socket.on('join_project', (projectId: string) => {
            socket.join(`project_${projectId}`);
            logger.info(`Socket ${socket.id} joined project_${projectId}`);
        });

        socket.on('leave_project', (projectId: string) => {
            socket.leave(`project_${projectId}`);
            logger.info(`Socket ${socket.id} left project_${projectId}`);
        });

        socket.on('disconnect', () => {
            logger.info(`Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getSocketIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
