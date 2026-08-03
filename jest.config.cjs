/** @type {import('jest').Config} */
module.exports = {
  // NOTE: The local jest runner (packages/jest) auto-loads the
  // setupFiles below before each test file. Tests that need DOM
  // globals no longer need to import dom-setup.js manually.
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(test).[jt]s'],
  setupFiles: ['<rootDir>/tests/helpers/dom-setup.js'],

  // Coverage configuration.
  // NOTE: The local jest runner (packages/jest) does not currently
  // support coverage instrumentation. These settings apply when running
  // tests with real Jest (e.g. `npx jest --coverage`). Update the
  // thresholds below as coverage grows over time.
  // 2026-08-03: collectCoverage を true に変更し、初回計測時の現実的な閾値に調整。
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/types.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      lines: 30,
      functions: 30,
      statements: 30,
      branches: 25
    },
    './src/state/': {
      lines: 50,
      functions: 50,
      statements: 50
    },
    './src/services/': {
      lines: 40,
      functions: 40,
      statements: 40
    },
    './src/utils/': {
      lines: 70,
      functions: 70,
      statements: 70
    }
  }
};
