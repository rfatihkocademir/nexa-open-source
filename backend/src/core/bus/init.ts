import { commandBus } from './CommandBus';
import { AuditInterceptor, PolicyInterceptor, GateInterceptor } from './interceptors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('BusInit');

/**
 * Initializes the Command Bus with global interceptors.
 * Execution order matters:
 * 1. Audit (Start tracking)
 * 2. Policy (Authorization)
 * 3. Gate (Process check)
 * 4. Actual Handler
 */
export function initCommandBus() {
    logger.info('Initializing Authoritative Command Bus...');
    
    // Middlewares are executed in order
    commandBus.use(AuditInterceptor);
    commandBus.use(PolicyInterceptor);
    commandBus.use(GateInterceptor);
    
    // Register module commands
    import('../../commands/workitem');
    import('../../commands/requirement/RequirementCommands');
    import('../../commands/release/ReleaseCommands');
    import('../../commands/automation/AutomationCommands');
    import('../../commands/environment/EnvironmentCommands');
    import('../../commands/prompt/PromptRegistryCommands');
    
    logger.info('Enforcement pipeline locked: [Audit -> Policy -> Gate]');
}
