#!/usr/bin/env node
/**
 * Mock Claude CLI for testing.
 *
 * Environment variables:
 * - MOCK_SESSION_ID: Session ID to return (default: random UUID)
 * - MOCK_DELAY_MS: Delay between output chunks (default: 0)
 * - MOCK_EXIT_CODE: Exit code (default: 0)
 * - MOCK_OUTPUT_FILE: Read output from file instead of generating
 * - MOCK_IGNORE_SIGTERM: If set, ignore SIGTERM (for force-kill testing)
 * - MOCK_ERROR: If set, output this error message and exit 1
 */

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const sessionId = process.env.MOCK_SESSION_ID || randomUUID();
const delayMs = parseInt(process.env.MOCK_DELAY_MS || '0', 10);
const exitCode = parseInt(process.env.MOCK_EXIT_CODE || '0', 10);
const outputFile = process.env.MOCK_OUTPUT_FILE;
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
    console.log(JSON.stringify({
      type: 'system',
      subtype: 'init',
      session_id: sessionId,
      uuid: randomUUID(),
      cwd: '/test'
    }));
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

  // Generate mock stream-json output
  const uuid1 = randomUUID();
  const uuid2 = randomUUID();
  const uuid3 = randomUUID();

  console.log(JSON.stringify({
    type: 'system',
    subtype: 'init',
    session_id: sessionId,
    uuid: uuid1,
    cwd: '/test',
    model: 'claude-3-7-sonnet-latest',
    permissionMode: 'bypassPermissions',
    tools: [{ name: 'bash' }, { name: 'write_file' }]
  }));
  if (delayMs > 0) await sleep(delayMs);

  console.log(JSON.stringify({
    type: 'assistant',
    session_id: sessionId,
    uuid: uuid2,
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'Mock response' }],
      usage: { input_tokens: 100, output_tokens: 10 }
    }
  }));
  if (delayMs > 0) await sleep(delayMs);

  console.log(JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    session_id: sessionId,
    uuid: uuid3,
    result: 'Mock response',
    duration_ms: 1500
  }));

  process.exit(exitCode);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
