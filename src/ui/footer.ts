/**
 * Footer component - Completion summary display
 * Shows execution stats, duration, and resume information
 */

import boxen from 'boxen';
import { getTheme, isColorEnabled } from './theme.js';
import type { BackendName, ExecutionStats } from '../adapters/types.js';

export interface FooterOptions {
  backend: BackendName;
  durationMs: number;
  stats?: ExecutionStats | null;
  sessionId?: string;
  colorEnabled?: boolean;
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Format token count with locale-aware separators
 */
function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Format cost in USD
 */
function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(2)}`;
}

/**
 * Render the execution footer with stats
 */
export function renderFooter(options: FooterOptions): string {
  const { backend, durationMs, stats, sessionId, colorEnabled } = options;
  const useColor = colorEnabled ?? isColorEnabled();
  const theme = getTheme(useColor);

  const lines: string[] = [];

  // Stats line
  const statParts: string[] = [];
  statParts.push(`${theme.dim('Duration:')} ${formatDuration(durationMs)}`);

  if (stats?.tokens) {
    statParts.push(`${theme.dim('Tokens:')} ${formatTokens(stats.tokens)}`);
  }

  if (stats?.costUsd !== undefined) {
    statParts.push(`${theme.dim('Cost:')} ${formatCost(stats.costUsd)}`);
  }

  lines.push(statParts.join('  │  '));

  // Session/resume info
  if (sessionId) {
    lines.push('');
    lines.push(theme.info(`Session: ${sessionId}`));
    lines.push(
      theme.dim(`Resume: hyperyolo ${backend} --resume ${sessionId} "continue"`)
    );
  }

  const content = lines.join('\n');

  if (useColor) {
    return boxen(content, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'single',
      borderColor: 'gray',
      title: '✨ Complete',
      titleAlignment: 'center'
    });
  }

  // No-color fallback
  const separator = '━'.repeat(60);
  return [
    '',
    separator,
    content,
    separator,
    ''
  ].join('\n');
}

/**
 * Create a minimal footer (simpler, matches shared.ts printFooter style)
 */
export function createMinimalFooter(options: FooterOptions): string {
  const { backend, durationMs, stats, sessionId } = options;
  const lines: string[] = [];

  lines.push('');
  lines.push('━'.repeat(60));

  // Stats line
  const statParts: string[] = [];
  statParts.push(`Duration: ${formatDuration(durationMs)}`);

  if (stats?.tokens) {
    statParts.push(`Tokens: ${formatTokens(stats.tokens)}`);
  }

  if (stats?.costUsd !== undefined) {
    statParts.push(`Cost: ${formatCost(stats.costUsd)}`);
  }

  lines.push(statParts.join(' | '));

  // Session/resume info
  if (sessionId) {
    lines.push('');
    lines.push(`Resume: hyperyolo ${backend} --resume ${sessionId} "continue"`);
  }

  lines.push('━'.repeat(60));
  lines.push('');

  return lines.join('\n');
}

/**
 * Print the footer to stdout
 */
export function printFooter(options: FooterOptions): void {
  console.log(renderFooter(options));
}

/**
 * Print minimal footer to stdout
 */
export function printMinimalFooter(options: FooterOptions): void {
  console.log(createMinimalFooter(options));
}
