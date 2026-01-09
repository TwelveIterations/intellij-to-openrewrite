import { jest } from '@jest/globals'

export const findNeoForgeVersion =
  jest.fn<typeof import('../src/version.js').findNeoForgeVersion>()
