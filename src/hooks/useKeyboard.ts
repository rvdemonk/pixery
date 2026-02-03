import { useEffect, useCallback } from 'react';

interface KeyboardHandlers {
  onNext?: () => void;
  onPrevious?: () => void;
  onToggleStar?: () => void;
  onFocusTags?: () => void;
  onOpenDetails?: () => void;
  onCompare?: () => void;
  onRegenerate?: () => void;
  onFocusGenerate?: () => void;
  onFocusSearch?: () => void;
  onEscape?: () => void;
  onDelete?: () => void;
  onShowHelp?: () => void;
  // Batch selection handlers
  onMark?: () => void;
  onClearSelection?: () => void;
  onBatchTag?: () => void;
  onBatchRefs?: () => void;
  onBatchRegen?: () => void;
  onBatchDelete?: () => void;
  hasSelection?: boolean;
}

export function useKeyboard(handlers: KeyboardHandlers, enabled = true) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      if (e.key === 'Escape' && handlers.onEscape) {
        handlers.onEscape();
        target.blur();
      }
      return;
    }

    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        handlers.onNext?.();
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        handlers.onPrevious?.();
        break;
      case 'f':
        e.preventDefault();
        handlers.onToggleStar?.();
        break;
      case 'm':
        e.preventDefault();
        handlers.onMark?.();
        break;
      case 'u':
        e.preventDefault();
        handlers.onClearSelection?.();
        break;
      case 't':
        e.preventDefault();
        if (handlers.hasSelection && handlers.onBatchTag) {
          handlers.onBatchTag();
        } else {
          handlers.onFocusTags?.();
        }
        break;
      case 'Enter':
        e.preventDefault();
        handlers.onOpenDetails?.();
        break;
      case 'c':
        e.preventDefault();
        handlers.onCompare?.();
        break;
      case 'r':
        e.preventDefault();
        if (handlers.hasSelection && handlers.onBatchRefs) {
          handlers.onBatchRefs();
        } else {
          handlers.onRegenerate?.();
        }
        break;
      case 'g':
        e.preventDefault();
        if (handlers.hasSelection && handlers.onBatchRegen) {
          handlers.onBatchRegen();
        } else {
          handlers.onFocusGenerate?.();
        }
        break;
      case '/':
        e.preventDefault();
        handlers.onFocusSearch?.();
        break;
      case '?':
        e.preventDefault();
        handlers.onShowHelp?.();
        break;
      case 'Escape':
        e.preventDefault();
        handlers.onEscape?.();
        break;
      case 'Delete':
      case 'Backspace':
        if (handlers.hasSelection && handlers.onBatchDelete) {
          e.preventDefault();
          handlers.onBatchDelete();
        } else if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          handlers.onDelete?.();
        }
        break;
    }
  }, [handlers]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
