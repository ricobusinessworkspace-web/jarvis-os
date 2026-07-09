import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock framer-motion to avoid animation overhead and warnings in jsdom
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  
  // Custom mock element creator
  const createMockComponent = (tag: string) => {
    return ({ children, ...props }: any) => {
      // Filter out motion props that shouldn't go to standard HTML elements
      const cleanProps = Object.keys(props)
        .filter(key => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'variants', 'animationDelay'].includes(key))
        .reduce((acc, key) => ({ ...acc, [key]: props[key] }), {});
      return React.createElement(tag, cleanProps, children);
    };
  };

  return {
    ...actual,
    motion: {
      ...actual.motion,
      div: createMockComponent('div'),
      span: createMockComponent('span'),
      button: createMockComponent('button'),
      p: createMockComponent('p'),
      h1: createMockComponent('h1'),
      h2: createMockComponent('h2'),
      h3: createMockComponent('h3'),
      a: createMockComponent('a'),
    },
    AnimatePresence: ({ children }: any) => children,
  };
});

// Suppress console.error and console.warn during test execution unless they are explicit test targets
const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: React does not recognize') ||
      args[0].includes('React.createFactory') ||
      args[0].includes('act(...)'))
  ) {
    return;
  }
  originalConsoleError(...args);
};
