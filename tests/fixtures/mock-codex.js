#!/usr/bin/env node
/**
 * Mock Codex CLI for testing.
 *
 * Environment variables:
 * - MOCK_SESSION_ID: Session ID to return (default: random UUID)
 * - MOCK_DELAY_MS: Delay between output chunks (default: 0)
 * - MOCK_EXIT_CODE: Exit code (default: 0)
 * - MOCK_OUTPUT_FILE: Read output from file instead of generating
 * - MOCK_OUTPUT_FORMAT: 'json' or 'text' (default: 'json')
 * - MOCK_IGNORE_SIGTERM: If set, ignore SIGTERM (for force-kill testing)
 * - MOCK_ERROR: If set, output this error message and exit 1
 */

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const sessionId = process.env.MOCK_SESSION_ID || randomUUID();
const delayMs = parseInt(process.env.MOCK_DELAY_MS || '0', 10);
const exitCode = parseInt(process.env.MOCK_EXIT_CODE || '0', 10);
const outputFile = process.env.MOCK_OUTPUT_FILE;
const outputFormat = process.env.MOCK_OUTPUT_FORMAT || 'json';
const ignoreSigterm = process.env.MOCK_IGNORE_SIGTERM === '1';
const errorMessage = process.env.MOCK_ERROR;
const waitForever = process.env.MOCK_WAIT_FOREVER === '1';

// Signal handling
if (ignoreSigterm) {
  process.on('SIGTERM', () => {
    // Ignore - force test to use SIGKILL
  });
} else {
  process.on('SIGTERM', () => {
    process.exit(143);
  });
}

process.on('SIGINT', () => {
  process.exit(130);
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // Error mode
  if (errorMessage) {
    console.error(errorMessage);
    process.exit(1);
  }

  // Wait forever mode - for signal testing
  if (waitForever) {
    // Output one line then wait forever
    console.log(JSON.stringify({ type: 'thread.started', thread_id: sessionId }));
    // Keep process alive indefinitely with interval
    setInterval(() => {}, 60000);
    return;
  }

  // Custom output file
  if (outputFile) {
    const content = readFileSync(outputFile, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (line) {
        console.log(line);
        if (delayMs > 0) await sleep(delayMs);
      }
    }
    process.exit(exitCode);
  }

  // Generate mock output
  if (outputFormat === 'json') {
    // JSON mode output
    console.log(JSON.stringify({ type: 'thread.started', thread_id: sessionId }));
    if (delayMs > 0) await sleep(delayMs);

    console.log(JSON.stringify({ type: 'turn.started' }));
    if (delayMs > 0) await sleep(delayMs);

    console.log(JSON.stringify({
      type: 'item.completed',
      item: { id: 'item_1', type: 'agent_message', text: 'Mock response' }
    }));
    if (delayMs > 0) await sleep(delayMs);

    console.log(JSON.stringify({
      type: 'turn.completed',
      usage: { input_tokens: 100, cached_input_tokens: 50, output_tokens: 10 }
    }));
  } else {
    // Text mode output
    console.log('codex 0.66.0 - workspace /test');
    if (delayMs > 0) await sleep(delayMs);

    console.log('model: gpt-5.1-codex-max  approval: never  sandbox: read-only');
    if (delayMs > 0) await sleep(delayMs);

    console.log(`session id: ${sessionId}`);
    if (delayMs > 0) await sleep(delayMs);

    console.log('user: test prompt');
    console.log('codex: Mock response');
    if (delayMs > 0) await sleep(delayMs);

    console.log('tokens used 100');
  }

  process.exit(exitCode);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
