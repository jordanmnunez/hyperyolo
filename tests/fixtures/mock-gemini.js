#!/usr/bin/env node
/**
 * Mock Gemini CLI for testing.
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
      type: 'init',
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      model: 'gemini-2.5-pro'
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
  const timestamp = new Date().toISOString();

  console.log(JSON.stringify({
    type: 'init',
    timestamp,
    session_id: sessionId,
    model: 'gemini-2.5-pro'
  }));
  if (delayMs > 0) await sleep(delayMs);

  console.log(JSON.stringify({
    type: 'message',
    timestamp,
    role: 'user',
    content: 'test prompt'
  }));
  if (delayMs > 0) await sleep(delayMs);

  console.log(JSON.stringify({
    type: 'message',
    timestamp,
    role: 'assistant',
    content: 'Mock response'
  }));
  if (delayMs > 0) await sleep(delayMs);

  console.log(JSON.stringify({
    type: 'result',
    timestamp,
    status: 'success',
    stats: {
      total_tokens: 110,
      input_tokens: 100,
      output_tokens: 10,
      duration_ms: 1000,
      tool_calls: 0
    }
  }));

  process.exit(exitCode);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
