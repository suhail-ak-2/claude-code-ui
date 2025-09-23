/**
 * Jest setup file for session management tests
 */

import { jest } from '@jest/globals';

// Mock console methods to reduce noise during tests
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as any;
});

afterAll(() => {
  global.console = originalConsole;
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Only show errors during tests

// Increase timeout for integration tests
jest.setTimeout(30000);