import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsDarkTheme } from '../../theme/useIsDarkTheme';

describe('useIsDarkTheme', () => {
  beforeEach(() => {
    // Reset data-ui-theme before each test
    delete document.documentElement.dataset.uiTheme;
  });

  afterEach(() => {
    delete document.documentElement.dataset.uiTheme;
  });

  it('returns true when data-ui-theme is not set (defaults to dark)', () => {
    const { result } = renderHook(() => useIsDarkTheme());
    expect(result.current).toBe(true);
  });

  it('returns true when data-ui-theme is "dark"', () => {
    document.documentElement.dataset.uiTheme = 'dark';
    const { result } = renderHook(() => useIsDarkTheme());
    expect(result.current).toBe(true);
  });

  it('returns false when data-ui-theme is "light"', () => {
    document.documentElement.dataset.uiTheme = 'light';
    const { result } = renderHook(() => useIsDarkTheme());
    expect(result.current).toBe(false);
  });

  it('reacts to canvas-theme-changed events', () => {
    document.documentElement.dataset.uiTheme = 'dark';
    const { result } = renderHook(() => useIsDarkTheme());
    expect(result.current).toBe(true);

    // Simulate theme change to light
    act(() => {
      document.documentElement.dataset.uiTheme = 'light';
      window.dispatchEvent(new Event('canvas-theme-changed'));
    });
    expect(result.current).toBe(false);

    // Simulate theme change back to dark
    act(() => {
      document.documentElement.dataset.uiTheme = 'dark';
      window.dispatchEvent(new Event('canvas-theme-changed'));
    });
    expect(result.current).toBe(true);
  });

  it('cleans up event listener on unmount', () => {
    const { unmount } = renderHook(() => useIsDarkTheme());
    const spy = vi.spyOn(window, 'removeEventListener');
    unmount();
    expect(spy).toHaveBeenCalledWith('canvas-theme-changed', expect.any(Function));
    spy.mockRestore();
  });
});
