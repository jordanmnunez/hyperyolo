/**
 * Theme module - Centralized color and style definitions
 * OSHA hazard palette for industrial terminal aesthetic
 * Built to be an OSHA violation.
 */

import chalk from 'chalk';
import gradientString from 'gradient-string';

/**
 * Check if color output is enabled
 * @param override - Explicit override (from --no-color flag)
 */
export function isColorEnabled(override?: boolean): boolean {
  if (override !== undefined) {
    return override;
  }
  // Respect NO_COLOR standard
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }
  // Let chalk decide based on terminal capabilities
  return chalk.level > 0;
}

/**
 * Color function type - simple text transformation
 */
export type ColorFn = (text: string) => string;

/**
 * Color palette interface
 */
export interface ColorPalette {
  primary: ColorFn;
  secondary: ColorFn;
  accent: ColorFn;
  success: ColorFn;
  error: ColorFn;
  warning: ColorFn;
  info: ColorFn;
  dim: ColorFn;
  bold: ColorFn;
}

/**
 * OSHA hazard color palette
 * Derived from ANSI Z535 safety signage standards
 * - Danger Red (#FF0000): Immediate hazard, execute actions
 * - Warning Orange (#FF4500): Active processes, caution
 * - Caution Yellow (#FFFF00): Attention required, warnings
 * - Safety Green (#00FF00): Success states, recovery
 * - Notice Blue (#0000FF): Information, links
 */
export const colors: ColorPalette = {
  primary: chalk.hex('#FF4500'),    // Warning Orange - primary brand color
  secondary: chalk.hex('#FFFF00'),  // Caution Yellow
  accent: chalk.hex('#00FFFF'),     // Cyan for accents
  success: chalk.hex('#00FF00'),    // Safety Green
  error: chalk.hex('#FF0000'),      // Danger Red
  warning: chalk.hex('#FFFF00'),    // Caution Yellow
  info: chalk.hex('#0000FF'),       // Notice Blue
  dim: chalk.dim,
  bold: chalk.bold
};

/**
 * Style functions for semantic text formatting
 */
export const success = (text: string): string => colors.success(text);
export const error = (text: string): string => colors.error(text);
export const warning = (text: string): string => colors.warning(text);
export const info = (text: string): string => colors.info(text);
export const dim = (text: string): string => colors.dim(text);
export const bold = (text: string): string => colors.bold(text);

/**
 * hyperyolo gradient definition - OSHA hazard aesthetic
 * Uses warning colors: orange -> red -> yellow (industrial heat)
 */
const hyperGradient = gradientString(['#FF4500', '#FF0000', '#FFFF00']);

/**
 * Apply gradient to text
 * Falls back to plain text if color is disabled
 */
export function gradient(text: string, colorEnabled = true): string {
  if (!colorEnabled || !isColorEnabled()) {
    return text;
  }
  return hyperGradient(text);
}

/**
 * Theme interface for consistent styling
 */
export interface Theme {
  success: ColorFn;
  error: ColorFn;
  warning: ColorFn;
  info: ColorFn;
  dim: ColorFn;
  bold: ColorFn;
  gradient: ColorFn;
  colors: ColorPalette;
}

/**
 * Create a no-color theme (passthrough functions)
 */
export function createNoColorTheme(): Theme {
  const passthrough = (text: string) => text;
  return {
    success: passthrough,
    error: passthrough,
    warning: passthrough,
    info: passthrough,
    dim: passthrough,
    bold: passthrough,
    gradient: passthrough,
    colors: {
      primary: passthrough,
      secondary: passthrough,
      accent: passthrough,
      success: passthrough,
      error: passthrough,
      warning: passthrough,
      info: passthrough,
      dim: passthrough,
      bold: passthrough
    }
  };
}

/**
 * Create a color theme
 */
export function createColorTheme(): Theme {
  return {
    success,
    error,
    warning,
    info,
    dim,
    bold,
    gradient: (text: string) => gradient(text, true),
    colors
  };
}

/**
 * Get theme based on color preference
 */
export function getTheme(colorEnabled?: boolean): Theme {
  const enabled = colorEnabled !== undefined ? colorEnabled : isColorEnabled();
  return enabled ? createColorTheme() : createNoColorTheme();
}
