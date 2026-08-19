import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Services required before the studio frame can mount. */
export declare const inject: string[];
/**
 * Client plugin body: provide the standard ctx.layout contract (owned by the
 * disabled ui-layout row) and register the studio frame into the runtime's
 * built-in root slot, declaring the standard child seats so the upstream
 * sidebar/conversation/details plugins keep their registration paths.
 * @param ctx - active browser Cordis context.
 */
export declare function apply(ctx: ClientContext): void;
