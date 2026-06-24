/** @type {import('jest').Config} */
module.exports = {
  // NOTE: The local jest runner (packages/jest) auto-loads the
  // setupFiles below before each test file. Tests that need DOM
  // globals no longer need to import dom-setup.js manually.
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(test).[jt]s'],
  setupFiles: ['<rootDir>/tests/helpers/dom-setup.js'],
};
