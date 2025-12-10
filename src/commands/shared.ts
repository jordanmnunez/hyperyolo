/**
 * Shared command execution logic
 */

import { randomBytes } from 'node:crypto';
import type { BackendAdapter, ExecutionOptions } from '../adapters/types.js';
import { executeWithTimeout } from '../core/executor.js';
import { createStreamTee } from '../core/stream-tee.js';
import { SessionStore } from '../core/session-store.js';

export interface CommandOptions {
  resume?: string;
  model?: string;
  rawArgs?: string[];
}

/**
 * Generate a HyperYOLO session ID.
 * Format: hyper_<8 hex chars>
 */
function generateHyperYoloId(): string {
  return `hyper_${randomBytes(4).toString('hex')}`;
}

export interface GlobalOptions {
  verbose?: boolean;
  color?: boolean;
  ignoreVersionWarnings?: boolean;
}

export async function executeWithAdapter(
  adapter: BackendAdapter,
  prompt: string,
  options: CommandOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  // Check availability
  const availability = await adapter.isAvailable();
  if (!availability.available) {
    console.error(`Error: ${availability.error ?? 'Backend not available'}`);
    process.exit(1);
  }

  // Show version warnings if not suppressed
  if (availability.warnings?.length && !globalOptions.ignoreVersionWarnings) {
    for (const warning of availability.warnings) {
      console.warn(`Warning: ${warning}`);
    }
  }

  // Load session store
  const sessionStore = new SessionStore();
  const sessions = await sessionStore.read();

  // Resolve resume session ID
  let nativeResumeId: string | undefined;
  if (options.resume) {
    const session = sessions[options.resume];
    if (session && session.backend === adapter.name) {
      nativeResumeId = session.nativeId;
    } else if (adapter.sessionIdPattern.test(options.resume)) {
      // Assume it's a native ID
      nativeResumeId = options.resume;
    } else {
      console.error(`Error: Session not found: ${options.resume}`);
      process.exit(1);
    }
  }

  // Build execution options
  const execOptions: ExecutionOptions = {
    resumeSessionId: nativeResumeId,
    model: options.model,
    rawArgs: options.rawArgs
  };

  // Build command
  const { command, args, env } = adapter.buildCommand(prompt, execOptions);

  // Print header
  printHeader(adapter.name, options.resume);

  // Set up stream tee for parsing
  let nativeSessionId: string | null = null;
  let accumulated = '';

  const tee = createStreamTee({
    onRawChunk: (chunk, source) => {
      // Stream to terminal
      if (source === 'stdout') {
        process.stdout.write(chunk);
      } else {
        process.stderr.write(chunk);
      }
    },
    onSanitizedChunk: (text) => {
      accumulated += text;
      // Try to parse session ID
      if (!nativeSessionId) {
        nativeSessionId = adapter.parseSessionId(text, accumulated);
      }
    }
  });

  try {
    // Execute with timeout
    const result = await executeWithTimeout(command, args, {
      backend: adapter.name,
      env: env as NodeJS.ProcessEnv,
      onStdout: (chunk) => tee.write(chunk, 'stdout'),
      onStderr: (chunk) => tee.write(chunk, 'stderr')
    });

    // Parse stats from accumulated output
    const stats = adapter.parseStats(tee.getAccumulated());

    // Generate and save session mapping
    let hyperYoloId: string | undefined;
    if (nativeSessionId) {
      hyperYoloId = generateHyperYoloId();
      const sessionIdToSave = nativeSessionId; // Ensure non-null for closure
      await sessionStore.update((current) => ({
        ...current,
        [hyperYoloId!]: {
          backend: adapter.name,
          nativeId: sessionIdToSave,
          createdAt: new Date().toISOString()
        }
      }));
    }

    // Print footer
    printFooter(adapter.name, result.durationMs, stats, hyperYoloId);

    process.exit(result.exitCode);
  } catch (error) {
    console.error('\nExecution failed:', error);
    process.exit(1);
  }
}

function printHeader(backend: string, resumeId?: string): void {
  console.log();
  console.log('━'.repeat(60));
  console.log(`⚡ HYPERYOLO - ${backend.toUpperCase()}`);
  if (resumeId) {
    console.log(`⚡ RESUMING: ${resumeId}`);
  }
  console.log('━'.repeat(60));
  console.log();
}

function printFooter(
  backend: string,
  durationMs: number,
  stats: { tokens?: number; costUsd?: number } | null,
  sessionId?: string
): void {
  console.log();
  console.log('━'.repeat(60));

  const parts: string[] = [`Duration: ${(durationMs / 1000).toFixed(1)}s`];
  if (stats?.tokens) {
    parts.push(`Tokens: ${stats.tokens.toLocaleString()}`);
  }
  if (stats?.costUsd) {
    parts.push(`Cost: $${stats.costUsd.toFixed(2)}`);
  }
  console.log(parts.join(' | '));

  if (sessionId) {
    console.log();
    console.log(`Resume: hyperyolo ${backend} --resume ${sessionId} "continue"`);
  }

  console.log('━'.repeat(60));
  console.log();
}
