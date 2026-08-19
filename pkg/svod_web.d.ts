/* tslint:disable */
/* eslint-disable */

/**
 * The result of executing a `:`-command.
 */
export class CommandResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The text to display (empty when the command produces no output).
     */
    readonly text: string;
    /**
     * Whether the frontend should clear the terminal output.
     */
    clear: boolean;
    /**
     * Whether the frontend should end the session (reload the page).
     */
    quit: boolean;
}

/**
 * One persistent Svod interpreter for a browser session.
 */
export class Svod {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Executes a `:`-command (without the leading `:`) and returns the text
     * to display plus the requested side effects.
     */
    command(input: string): CommandResult;
    /**
     * Highlights svod source text with ANSI colours for the terminal widget.
     */
    highlight(code: string): string;
    /**
     * Evaluates one line and returns the rendered output.
     */
    interpret(code: string): SvodOutput;
    /**
     * Creates a fresh interpreter.
     *
     * A `Default` implementation makes no sense for the JavaScript-facing
     * constructor, so the clippy `new_without_default` lint is allowed here.
     */
    constructor();
    /**
     * Queues a raw user answer (a number with an optional unit, or a choice
     * index/prefix) for the current submission's next prompt.
     */
    queue_input(text: string): void;
    /**
     * Starts a fresh submission: clears queued answers and the prompt cache.
     * Call once before the first `interpret` of each user-entered line.
     */
    reset_input(): void;
    /**
     * Sets the output language: `"ru"` selects Russian, anything else English.
     */
    set_lang(lang: string): void;
}

/**
 * The result of evaluating one REPL input.
 */
export class SvodOutput {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Whether the run failed with a parse or runtime error.
     */
    is_error: boolean;
    /**
     * The rendered output text (empty when the input produced nothing).
     */
    readonly output: string;
    /**
     * The text of an unanswered prompt (an `input`/`choice()`), or `null`
     * when the run finished. Set together with a non-error result.
     */
    readonly pending_prompt: string | undefined;
}

/**
 * Installs the panic hook that logs Rust panics to the browser console via
 * `console.error`, making wasm crashes debuggable.
 */
export function setup_panic_hook(): void;

/**
 * The welcome banner shown at the top of the terminal, in the current
 * language (set via [`Svod::set_lang`]).
 */
export function welcome_text(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_commandresult_free: (a: number, b: number) => void;
    readonly __wbg_get_commandresult_clear: (a: number) => number;
    readonly __wbg_get_commandresult_quit: (a: number) => number;
    readonly __wbg_get_svodoutput_is_error: (a: number) => number;
    readonly __wbg_set_commandresult_clear: (a: number, b: number) => void;
    readonly __wbg_set_commandresult_quit: (a: number, b: number) => void;
    readonly __wbg_set_svodoutput_is_error: (a: number, b: number) => void;
    readonly __wbg_svod_free: (a: number, b: number) => void;
    readonly __wbg_svodoutput_free: (a: number, b: number) => void;
    readonly commandresult_text: (a: number, b: number) => void;
    readonly svod_command: (a: number, b: number, c: number) => number;
    readonly svod_highlight: (a: number, b: number, c: number, d: number) => void;
    readonly svod_interpret: (a: number, b: number, c: number) => number;
    readonly svod_new: () => number;
    readonly svod_queue_input: (a: number, b: number, c: number) => void;
    readonly svod_reset_input: (a: number) => void;
    readonly svod_set_lang: (a: number, b: number, c: number) => void;
    readonly svodoutput_output: (a: number, b: number) => void;
    readonly svodoutput_pending_prompt: (a: number, b: number) => void;
    readonly welcome_text: (a: number) => void;
    readonly setup_panic_hook: () => void;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number, b: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
