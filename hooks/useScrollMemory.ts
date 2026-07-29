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
    
    // Request animation frame to ensure DOM is rendered
    requestAnimationFrame(() => {
      container.scrollTop = targetScroll;
    });

    prevPage.current = currentPage;
  }, [currentPage, containerId]);

  return scrollPositions;
};
