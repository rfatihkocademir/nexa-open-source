import { ICommand, ICommandHandler } from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CommandBus');

export type CommandInterceptor = (command: ICommand, next: () => Promise<any>) => Promise<any>;

/**
 * CommandBus is the authoritative dispatcher for all Nexa write operations.
 * It enforces cross-cutting concerns (Policy, Gates, Audit) via Interceptors.
 */
class CommandBus {
    private handlers: Map<string, ICommandHandler> = new Map();
    private interceptors: CommandInterceptor[] = [];

    /**
     * Registers a handler for a specific command name.
     */
    registerHandler(commandName: string, handler: ICommandHandler) {
        if (this.handlers.has(commandName)) {
            logger.warn(`Handler for ${commandName} is being overwritten.`);
        }
        this.handlers.set(commandName, handler);
        logger.debug(`Registered handler for ${commandName}`);
    }

    /**
     * Adds an interceptor to the command pipeline.
     */
    use(interceptor: CommandInterceptor) {
        this.interceptors.push(interceptor);
    }

    /**
     * Dispatches a command to its registered handler through the interceptor pipeline.
     */
    async dispatch<R = any>(command: ICommand): Promise<R> {
        const handler = this.handlers.get(command.commandName);

        if (!handler) {
            throw new Error(`No handler registered for command: ${command.commandName}`);
        }

        // Create the execution chain
        let index = -1;
        const interceptors = this.interceptors;

        const runner = async (i: number): Promise<R> => {
            if (i <= index) throw new Error('next() called multiple times');
            index = i;

            if (i === interceptors.length) {
                // End of chain, call the actual handler
                return await handler.handle(command);
            } else {
                // Call the next interceptor
                return await interceptors[i](command, () => runner(i + 1));
            }
        };

        return runner(0);
    }
}

// Singleton instance
export const commandBus = new CommandBus();
