import { useEffect, useRef } from 'react';
import { Page } from '../types';

export const useScrollMemory = (currentPage: Page, containerId: string = 'main-content') => {
  const scrollPositions = useRef<Record<string, number>>({});
  const prevPage = useRef<string>(currentPage);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Save scroll position of the previous page
    if (prevPage.current && prevPage.current !== currentPage) {
      scrollPositions.current[prevPage.current] = container.scrollTop;
    }

    // Restore scroll position for the new page, or default to top (0)
    const targetScroll = scrollPositions.current[currentPage] || 0;
    
    // Request animation frame and post-transition timeout so AnimatePresence mode="wait" (150ms) settles
    let userScrolled = false;
    const onUserScroll = () => { userScrolled = true; };
    container.addEventListener('wheel', onUserScroll, { passive: true, once: true });
    container.addEventListener('touchmove', onUserScroll, { passive: true, once: true });

    const rafId = requestAnimationFrame(() => {
      if (!userScrolled) container.scrollTop = targetScroll;
    });
    const timerId = window.setTimeout(() => {
      if (!userScrolled) container.scrollTop = targetScroll;
    }, 170);

    prevPage.current = currentPage;
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      container.removeEventListener('wheel', onUserScroll);
      container.removeEventListener('touchmove', onUserScroll);
    };
  }, [currentPage, containerId]);

  return scrollPositions;
};
