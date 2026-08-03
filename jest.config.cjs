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
  collectCoverage: false,
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
      lines: 50,
      functions: 50,
      statements: 50,
      branches: 40
    },
    './src/state/': {
      lines: 70,
      functions: 70,
      statements: 70
    },
    './src/services/': {
      lines: 70,
      functions: 70,
      statements: 70
    },
    './src/utils/': {
      lines: 70,
      functions: 70,
      statements: 70
    }
  }
};
