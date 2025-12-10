import type {
  AvailabilityResult,
  BackendAdapter,
  BackendName,
  CommandBuildResult,
  ExecutionOptions,
  ExecutionStats
} from '../../src/adapters/types.js';

const DEFAULT_ID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export interface MockAdapterOptions {
  availability?: AvailabilityResult;
  sessionId?: string;
  sessionIdPattern?: RegExp;
  stats?: ExecutionStats | null;
  command?: string;
  baseArgs?: string[];
  env?: Record<string, string>;
}

export class MockAdapter implements BackendAdapter {
  name: BackendName;
  sessionIdPattern: RegExp;

  private readonly availability: AvailabilityResult;
  private readonly fixedSessionId?: string;
  private readonly stats: ExecutionStats | null;
  private readonly baseArgs: string[];
  private readonly command: string;
  private readonly env: Record<string, string>;

  constructor(name: BackendName = 'codex', options: MockAdapterOptions = {}) {
    this.name = name;
    this.sessionIdPattern = options.sessionIdPattern ?? DEFAULT_ID_PATTERN;
    this.fixedSessionId = options.sessionId;
    this.stats = options.stats ?? null;
    this.baseArgs = options.baseArgs ?? ['exec'];
    this.command = options.command ?? `${name}-cli`;
    this.env = options.env ?? {};
    this.availability = options.availability ?? {
      available: true,
      version: '0.0.0-mock'
    };
  }

  async isAvailable(): Promise<AvailabilityResult> {
    return this.availability;
  }

  buildCommand(prompt: string, options: ExecutionOptions): CommandBuildResult {
    const args = [...this.baseArgs, prompt];

    if (options.resumeSessionId) {
      args.push('--resume', options.resumeSessionId);
    }

    if (options.model) {
      args.push('--model', options.model);
    }

    if (options.outputFormat) {
      args.push('--output-format', options.outputFormat);
    }

    if (options.rawArgs?.length) {
      args.push(...options.rawArgs);
    }

    return {
      command: this.command,
      args,
      env: Object.keys(this.env).length ? this.env : undefined
    };
  }

  parseSessionId(chunk: string, accumulated: string): string | null {
    const combined = `${accumulated}${chunk}`;
    const match = combined.match(this.sessionIdPattern);
    if (!match) {
      return null;
    }

    const value = match[1] ?? match[0] ?? null;
    return this.fixedSessionId ?? value;
  }

  parseStats(_output: string): ExecutionStats | null {
    return this.stats;
  }
}
