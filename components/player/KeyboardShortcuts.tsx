'use client';

import { useEffect } from 'react';
import { usePlayer } from './PlayerProvider';

/** True when the user is typing, so a shortcut never eats a keystroke. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export function KeyboardShortcuts() {
  const { toggle, next, previous, seek, position } = usePlayer();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case ' ':
          // Space would otherwise scroll the list.
          event.preventDefault();
          toggle();
          break;
        case 'ArrowRight':
          event.preventDefault();
          seek(position + 5);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          seek(Math.max(0, position - 5));
          break;
        case 'n':
          next();
          break;
        case 'p':
          previous();
          break;
        default:
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle, next, previous, seek, position]);

  return null;
}
