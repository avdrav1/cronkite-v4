// Test setup file for Vitest
import { beforeAll, afterAll } from 'vitest'
import '@testing-library/jest-dom'

beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test'
})

afterAll(async () => {
  // Cleanup after tests
})