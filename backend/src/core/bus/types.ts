import { AuditContext } from '../../services/audit.service';
import { PolicyResource, PolicyAction } from '../../utils/policyEvaluator';

/**
 * Metadata carried by every command to enable policy enforcement, 
 * auditing, and scope validation.
 */
export interface CommandContext extends AuditContext {
    role: string;
    projectId?: string;
    traceId?: string;
}

/**
 * Base Command interface. 
 * Every write operation MUST be represented as a command.
 */
export interface ICommand {
    readonly commandName: string;
    readonly context: CommandContext;
    
    // Policy mappings
    getPolicyResource(): PolicyResource;
    getPolicyAction(): PolicyAction;

    // Optional Gate Check
    checkGates?(): Promise<void>;
}

/**
 * Base Command Handler interface.
 */
export interface ICommandHandler<T extends ICommand = ICommand, R = any> {
    handle(command: T): Promise<R>;
}

export type CommandInterceptor = (command: ICommand, next: () => Promise<any>) => Promise<any>;
