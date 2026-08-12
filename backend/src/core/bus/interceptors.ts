import { CommandInterceptor } from './types';
import { enforcePolicy } from '../../utils/policyEvaluator';
import { auditService } from '../../services/audit.service';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CommandBusInterceptors');

/**
 * 1. Policy Interceptor: Mandatory Authorization
 */
export const PolicyInterceptor: CommandInterceptor = async (command, next) => {
    const subject = {
        actorId: command.context.actorId,
        actorRole: command.context.role,
        permissions: [], // We could populate this if needed
    };

    const resource = command.getPolicyResource();
    const action = command.getPolicyAction();

    logger.debug(`Enforcing policy for ${command.commandName} - Action: ${action.action}, Resource: ${resource.resourceType}`);
    
    await enforcePolicy(subject, resource, action);
    
    return next();
};

/**
 * 2. Gate Interceptor: Functional Process Enforcements
 */
export const GateInterceptor: CommandInterceptor = async (command, next) => {
    if (command.checkGates) {
        logger.debug(`Checking workflow gates for ${command.commandName}`);
        await command.checkGates();
    }
    return next();
};

/**
 * 3. Audit Interceptor: Post-execution Traceability
 */
export const AuditInterceptor: CommandInterceptor = async (command, next) => {
    const startTime = Date.now();
    
    try {
        const result = await next();
        
        // Log successful execution
        await auditService.log({
            context: command.context,
            entityType: command.getPolicyResource().resourceType,
            entityId: command.getPolicyResource().resourceId || 'new',
            action: command.commandName,
            before: {}, // We could add snapshotting here later
            after: { 
                success: true, 
                durationMs: Date.now() - startTime 
            },
        });

        return result;
    } catch (error) {
        // Log failure
        await auditService.log({
            context: command.context,
            entityType: command.getPolicyResource().resourceType,
            entityId: command.getPolicyResource().resourceId || 'unknown',
            action: `${command.commandName}_FAILED`,
            after: { 
                success: false, 
                error: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - startTime 
            },
        }, false);
        
        throw error;
    }
};
