/** @type {import('jest').Config} */
module.exports = {
  // NOTE: The local jest (packages/jest) used in this project does not
  // support testEnvironment: 'jsdom'. Tests that need DOM globals must
  // import './helpers/dom-setup.js' at the top of their file. The dom-setup
  // helper manually attaches jsdom to globalThis.
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/?(*.)+(test).[jt]s']
};
