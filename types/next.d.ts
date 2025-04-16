import type { NextRequest } from 'next/server';

// Add global type definitions for Next.js 15 route handlers
declare module 'next' {
  // Define route params shape
  export interface RouteParams<T = Record<string, string>> {
    params: T;
  }
} 