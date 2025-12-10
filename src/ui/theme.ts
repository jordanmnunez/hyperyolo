/**
 * Theme module - Centralized color and style definitions
 * Supports NO_COLOR environment variable and graceful degradation
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
 * Color palette using chalk
 */
export const colors: ColorPalette = {
  primary: chalk.cyan,
  secondary: chalk.magenta,
  accent: chalk.yellow,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
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
 * HyperYOLO gradient definition - maximalist aesthetic
 * Uses vibrant colors: cyan -> magenta -> yellow
 */
const hyperGradient = gradientString(['#00ffff', '#ff00ff', '#ffff00']);

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
