/**
 * Banner component - ASCII art header display
 * Terminalcore maximalism with graceful degradation
 * Built to be an OSHA violation.
 */

import figlet from 'figlet';
import boxen from 'boxen';
import { gradient, isColorEnabled, getTheme } from './theme.js';
import type { BackendName } from '../adapters/types.js';

export interface BannerOptions {
  backend: BackendName;
  version?: string;
  resumeId?: string;
  colorEnabled?: boolean;
}

/**
 * Generate ASCII art text using figlet
 */
function generateAsciiArt(text: string): string {
  try {
    return figlet.textSync(text, {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    });
  } catch {
    // Fallback to simpler font if ANSI Shadow fails
    try {
      return figlet.textSync(text, { font: 'Standard' });
    } catch {
      // Ultimate fallback
      return text;
    }
  }
}

/**
 * Render the full hyperyolo banner with ASCII art
 */
export function renderBanner(options: BannerOptions): string {
  const { backend, version, resumeId, colorEnabled } = options;
  const useColor = colorEnabled ?? isColorEnabled();
  const theme = getTheme(useColor);

  // Generate ASCII art
  const asciiArt = generateAsciiArt('HYPERYOLO');

  // Apply gradient if color is enabled
  const styledArt = useColor ? gradient(asciiArt, true) : asciiArt;

  // Build info lines
  const lines: string[] = [];
  lines.push(styledArt);
  lines.push('');

  // Engine info line
  const engineLabel = theme.bold(`ENGINE: ${backend.toUpperCase()}`);
  if (version) {
    lines.push(`${engineLabel} ${theme.dim(`v${version}`)}`);
  } else {
    lines.push(engineLabel);
  }

  // Resume info if applicable
  if (resumeId) {
    lines.push(theme.warning(`↩ RESUMING BURN: ${resumeId}`));
  }

  const content = lines.join('\n');

  // Wrap in box if color enabled, otherwise just add separators
  if (useColor) {
    return boxen(content, {
      padding: 1,
      margin: { top: 1, bottom: 0, left: 0, right: 0 },
      borderStyle: 'double',
      borderColor: 'cyan',
      title: '⚠ ROCKETS STRAPPED ⚠',
      titleAlignment: 'center'
    });
  }

  // No-color fallback with simple separators
  const separator = '═'.repeat(60);
  return [
    '',
    separator,
    content,
    separator
  ].join('\n');
}

/**
 * Create a minimal banner (simpler, less space)
 * Used for the printHeader function in shared.ts style
 */
export function createMinimalBanner(options: BannerOptions): string {
  const { backend, resumeId } = options;
  const lines: string[] = [];

  lines.push('');
  lines.push('━'.repeat(60));
  lines.push(`⚠ HYPERYOLO — ENGINE: ${backend.toUpperCase()}`);

  if (resumeId) {
    lines.push(`↩ RESUMING BURN: ${resumeId}`);
  }

  lines.push('━'.repeat(60));
  lines.push('');

  return lines.join('\n');
}

/**
 * Print the banner to stdout
 */
export function printBanner(options: BannerOptions): void {
  console.log(renderBanner(options));
}

/**
 * Print minimal banner to stdout
 */
export function printMinimalBanner(options: BannerOptions): void {
  console.log(createMinimalBanner(options));
}
