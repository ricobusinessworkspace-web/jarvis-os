'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  const router = useRouter();
  const startY = useRef(0);
  const currentY = useRef(0);
  const isAtTop = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const threshold = 80;

  useEffect(() => {
    // Find the closest scrollable parent (which is the main scroll container in the layout)
    const scrollContainer = containerRef.current?.closest('.overflow-y-auto') || window;
    
    const getScrollTop = () => {
      if (scrollContainer === window) return window.scrollY;
      return (scrollContainer as HTMLElement).scrollTop;
    };

    const handleTouchStart = (e: TouchEvent | Event) => {
      const touchEvent = e as TouchEvent;
      isAtTop.current = getScrollTop() <= 0;
      if (isAtTop.current && !refreshing && touchEvent.touches) {
        startY.current = touchEvent.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent | Event) => {
      const touchEvent = e as TouchEvent;
      if (!isAtTop.current || refreshing || !touchEvent.touches) return;
      
      currentY.current = touchEvent.touches[0].clientY;
      const dy = currentY.current - startY.current;
      
      if (dy > 0 && getScrollTop() <= 0) {
        setPulling(true);
        const progress = Math.min(dy / threshold, 1.2);
        setPullProgress(progress);
      } else {
        setPulling(false);
      }
    };

    const handleTouchEnd = () => {
      if (!pulling) return;
      
      const dy = currentY.current - startY.current;
      if (dy >= threshold && !refreshing) {
        setRefreshing(true);
        // Refresh Next.js server components
        router.refresh();
        
        // Let the spinner show for a second and then slide back
        setTimeout(() => {
          setRefreshing(false);
          setPulling(false);
          setPullProgress(0);
        }, 1200);
      } else {
        setPulling(false);
        setPullProgress(0);
      }
    };

    const handleWheel = (e: WheelEvent | Event) => {
      const wheelEvent = e as WheelEvent;
      isAtTop.current = getScrollTop() <= 0;
      // Negative deltaY means swiping down on a trackpad
      if (isAtTop.current && wheelEvent.deltaY < -50 && !refreshing && !pulling) {
        setRefreshing(true);
        router.refresh();
        setTimeout(() => setRefreshing(false), 1200);
      }
    };

    const options = { passive: true };
    scrollContainer.addEventListener('touchstart', handleTouchStart, options);
    scrollContainer.addEventListener('touchmove', handleTouchMove, options);
    scrollContainer.addEventListener('touchend', handleTouchEnd);
    scrollContainer.addEventListener('wheel', handleWheel, options);

    return () => {
      scrollContainer.removeEventListener('touchstart', handleTouchStart);
      scrollContainer.removeEventListener('touchmove', handleTouchMove);
      scrollContainer.removeEventListener('touchend', handleTouchEnd);
      scrollContainer.removeEventListener('wheel', handleWheel);
    };
  }, [refreshing, pulling, router]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Pull indicator */}
      <div 
        className="absolute left-0 w-full flex justify-center z-50 pointer-events-none transition-transform duration-200"
        style={{ 
          top: '-20px',
          transform: `translateY(${refreshing ? 40 : (pulling ? (pullProgress * threshold * 0.5) : 0)}px)`,
          opacity: refreshing || pulling ? 1 : 0 
        }}
      >
        <div className="bg-elevated border border-border/30 rounded-full p-2 shadow-lg flex items-center justify-center">
          <Loader2 
            className={`h-5 w-5 text-accent ${refreshing ? 'animate-spin' : ''}`} 
            style={{ transform: !refreshing ? `rotate(${pullProgress * 360}deg)` : 'none' }}
          />
        </div>
      </div>
      
      {/* Content wrapper that slides down */}
      <div 
        className="w-full transition-transform duration-200"
        style={{ transform: `translateY(${refreshing ? 40 : (pulling ? pullProgress * 30 : 0)}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
