import 'dotenv/config';
import app from './app';
// Triggering authoritative reload for error logging persistence
import { initAutomationWorker } from './workers/automation.worker';
import { initAIWorker } from './workers/ai.worker';
import { initBugReportingWorker } from './workers/bugReporting.worker';
import { SocketService } from './services/socket.service';
import { ensureBucket } from './services/minio.service';
import { initializePrompts } from './promptInit';
import { createLogger } from './utils/logger';
import { initCommandBus } from './core/bus/init';
import { cleanupService } from './services/cleanup.service';
import { actionCenterReconciliationService } from './services/action-center-reconciliation.service';
import { siemDeliveryWorker } from './services/siem.service';
import { operationalResilienceService } from './services/operational-resilience.service';

import './config';

initCommandBus();

const PORT = process.env.PORT || 3000;
const INSTANCE_ID = process.env.NODE_APP_INSTANCE || process.env.pm_id || 0;
const logger = createLogger(`Server:${INSTANCE_ID}`);

const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT} (PID: ${process.pid})`);

    // Initialize MinIO bucket only on the first instance (avoid race conditions)
    if (Number(INSTANCE_ID) === 0) {
        ensureBucket().catch((err) => {
            logger.warn('Bucket initialization skipped — file uploads will not work:', err.message);
        });
        initializePrompts().catch((err) => {
            logger.error('Prompt initialization failed:', err);
        });
    }

    // PM2 cluster mode: signal ready state
    if (process.send) {
        process.send('ready');
    }
});

// Initialize Socket Service (Redis adapter handles cross-instance communication)
new SocketService(server);

// Initialize Workers only on the first instance to avoid duplicate job processing
let automationWorker: any;
let aiWorker: any;
let bugReportingWorker: any;

if (Number(INSTANCE_ID) === 0) {
    automationWorker = initAutomationWorker();
    aiWorker = initAIWorker();
    bugReportingWorker = initBugReportingWorker();
    
    // Start automated cleanup job for soft-deleted items
    cleanupService.startCleanupJob();
    actionCenterReconciliationService.start();
    siemDeliveryWorker.start();
    operationalResilienceService.start();
    
    logger.info('Workers and Background Jobs initialized (primary instance)');
} else {
    logger.info('Skipping worker initialization (handled by instance 0)');
}

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received: shutting down gracefully...`);
    
    // Close workers only on the primary instance
    if (Number(INSTANCE_ID) === 0 && automationWorker) {
        actionCenterReconciliationService.stop();
        siemDeliveryWorker.stop();
        cleanupService.stopCleanupJob();
        await operationalResilienceService.stop();
        await automationWorker.close();
        await aiWorker.close();
        await bugReportingWorker.close();
        logger.info('Workers closed');
    }

    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });

    // Force exit after 5 seconds if graceful shutdown hangs
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
