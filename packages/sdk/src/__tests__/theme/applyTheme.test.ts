import { describe, it, expect, beforeEach } from 'vitest';
import {
  readThemeFromDOM,
  applyDeepSpaceTheme,
  clearDeepSpaceTheme,
  isDarkColor,
  DEEPSPACE_THEME_PROPERTIES,
} from '../../theme/applyTheme';

describe('isDarkColor', () => {
  it('returns true for black', () => {
    expect(isDarkColor('#000000')).toBe(true);
  });

  it('returns false for white', () => {
    expect(isDarkColor('#ffffff')).toBe(false);
  });

  it('returns true for a dark hex color', () => {
    expect(isDarkColor('#0f172a')).toBe(true);
  });

  it('returns false for a light hex color', () => {
    expect(isDarkColor('#f1f5f9')).toBe(false);
  });

  it('handles 3-character hex shorthand', () => {
    expect(isDarkColor('#000')).toBe(true);
    expect(isDarkColor('#fff')).toBe(false);
  });

  it('handles rgb() format', () => {
    expect(isDarkColor('rgb(0, 0, 0)')).toBe(true);
    expect(isDarkColor('rgb(255, 255, 255)')).toBe(false);
  });

  it('handles rgba() format', () => {
    expect(isDarkColor('rgba(0, 0, 0, 1)')).toBe(true);
    expect(isDarkColor('rgba(255, 255, 255, 0.5)')).toBe(false);
  });

  it('trims whitespace', () => {
    expect(isDarkColor('  #000000  ')).toBe(true);
    expect(isDarkColor('  #ffffff  ')).toBe(false);
  });

  it('returns true for unrecognised formats (assumes dark)', () => {
    expect(isDarkColor('hsl(0, 0%, 0%)')).toBe(true);
    expect(isDarkColor('not-a-color')).toBe(true);
  });
});

describe('readThemeFromDOM', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('returns fallback defaults when no CSS variables are set', () => {
    const theme = readThemeFromDOM(root);
    expect(theme.primaryColor).toBe('#0f172a');
    expect(theme.secondaryColor).toBe('#1e293b');
    expect(theme.accentColor).toBe('#818cf8');
    expect(theme.textColor).toBe('#f1f5f9');
    expect(theme.borderColor).toBe('rgba(51, 65, 85, 0.5)');
    expect(theme.backgroundColor).toBe('#0a0f1a');
    expect(theme.highlightColor).toBe('#ffffff');
    expect(theme.shadowColor).toBe('#000000');
    expect(theme.accentContrastColor).toBe('#ffffff');
  });

  it('reads custom properties from the root element', () => {
    root.style.setProperty('--color-surface-elevated', '#1a1a2e');
    root.style.setProperty('--color-surface-overlay', '#16213e');
    root.style.setProperty('--color-primary', '#e94560');
    root.style.setProperty('--color-content', '#eaeaea');
    root.style.setProperty('--color-border', '#333333');
    root.style.setProperty('--color-surface', '#0f0f23');

    const theme = readThemeFromDOM(root);
    expect(theme.primaryColor).toBe('#1a1a2e');
    expect(theme.secondaryColor).toBe('#16213e');
    expect(theme.accentColor).toBe('#e94560');
    expect(theme.textColor).toBe('#eaeaea');
    expect(theme.borderColor).toBe('#333333');
    expect(theme.backgroundColor).toBe('#0f0f23');
  });
});

describe('applyDeepSpaceTheme', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('sets --theme-accent to the provided accentColor', () => {
    applyDeepSpaceTheme({
      primaryColor: '#0f172a',
      secondaryColor: '#1e293b',
      accentColor: '#8b5cf6',
      textColor: '#f1f5f9',
    }, root);

    expect(root.style.getPropertyValue('--theme-accent')).toBe('#8b5cf6');
  });

  it('sets data-ui-theme to dark for a dark background', () => {
    applyDeepSpaceTheme({
      primaryColor: '#0f172a',
      secondaryColor: '#1e293b',
      accentColor: '#8b5cf6',
      textColor: '#f1f5f9',
      backgroundColor: '#000000',
    }, root);

    expect(root.dataset.uiTheme).toBe('dark');
  });

  it('sets data-ui-theme to light for a light background', () => {
    applyDeepSpaceTheme({
      primaryColor: '#ffffff',
      secondaryColor: '#f0f0f0',
      accentColor: '#3b82f6',
      textColor: '#111827',
      backgroundColor: '#ffffff',
    }, root);

    expect(root.dataset.uiTheme).toBe('light');
  });

  it('sets glassmorphism data attribute', () => {
    applyDeepSpaceTheme({
      primaryColor: '#0f172a',
      secondaryColor: '#1e293b',
      accentColor: '#8b5cf6',
      textColor: '#f1f5f9',
      glassmorphism: false,
    }, root);

    expect(root.dataset.glassmorphism).toBe('disabled');
  });

  it('does not include any --chat-* CSS variables', () => {
    applyDeepSpaceTheme({
      primaryColor: '#0f172a',
      secondaryColor: '#1e293b',
      accentColor: '#8b5cf6',
      textColor: '#f1f5f9',
    }, root);

    // Verify no --chat-* properties were set
    for (const prop of DEEPSPACE_THEME_PROPERTIES) {
      if (prop.startsWith('--chat-')) {
        throw new Error(`Found --chat-* property in DEEPSPACE_THEME_PROPERTIES: ${prop}`);
      }
    }

    // Also check the inline style string
    expect(root.style.cssText).not.toContain('--chat-');
  });
});

describe('clearDeepSpaceTheme', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('removes all theme properties from the root element', () => {
    applyDeepSpaceTheme({
      primaryColor: '#0f172a',
      secondaryColor: '#1e293b',
      accentColor: '#8b5cf6',
      textColor: '#f1f5f9',
    }, root);

    // Verify some properties are set
    expect(root.style.getPropertyValue('--theme-accent')).toBeTruthy();
    expect(root.style.getPropertyValue('--theme-text')).toBeTruthy();

    clearDeepSpaceTheme(root);

    // Verify they are cleared
    for (const prop of DEEPSPACE_THEME_PROPERTIES) {
      expect(root.style.getPropertyValue(prop)).toBe('');
    }
  });
});
