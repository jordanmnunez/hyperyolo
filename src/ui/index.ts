/**
 * UI Components Index
 * Exports all UI modules for HyperYOLO CLI
 */

// Theme module
export {
  isColorEnabled,
  colors,
  success,
  error,
  warning,
  info,
  dim,
  bold,
  gradient,
  getTheme,
  createColorTheme,
  createNoColorTheme,
  type Theme
} from './theme.js';

// Banner component
export {
  renderBanner,
  createMinimalBanner,
  printBanner,
  printMinimalBanner,
  type BannerOptions
} from './banner.js';

// Footer component
export {
  renderFooter,
  createMinimalFooter,
  printFooter,
  printMinimalFooter,
  type FooterOptions
} from './footer.js';
