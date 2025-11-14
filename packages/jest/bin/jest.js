#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { isDeepStrictEqual, inspect } = require('util');

const rootDir = process.cwd();
const testsDir = path.join(rootDir, 'tests');

if (!fs.existsSync(testsDir)) {
  console.error('No tests directory found at', testsDir);
  process.exit(1);
}

const findTestFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return findTestFiles(fullPath);
    }
    return entry.name.endsWith('.test.js') ? [fullPath] : [];
  });
};

const suitesForFile = (fileName) => {
  const createSuite = (name, parent = null) => ({
    name,
    parent,
    tests: [],
    beforeEach: [],
    afterEach: [],
    children: []
  });

  const rootSuite = createSuite(fileName);
  const stack = [rootSuite];

  const registerSuite = (name, fn) => {
    const parent = stack[stack.length - 1];
    const suite = createSuite(name, parent);
    parent.children.push(suite);
    stack.push(suite);
    try {
      fn();
    } finally {
      stack.pop();
    }
  };

  const registerTest = (name, fn) => {
    const current = stack[stack.length - 1];
    current.tests.push({ name, fn });
  };

  const registerBeforeEach = (fn) => {
    const current = stack[stack.length - 1];
    current.beforeEach.push(fn);
  };

  const registerAfterEach = (fn) => {
    const current = stack[stack.length - 1];
    current.afterEach.push(fn);
  };

  const makeExpect = (actual) => {
    const fail = (message) => {
      throw new Error(message);
    };

    const format = (value) => inspect(value, { depth: 5, colors: false });

    const api = {
      toBe(expected) {
        if (actual !== expected) {
          fail(`Expected ${format(actual)} to be ${format(expected)}`);
        }
      },
      toEqual(expected) {
        if (!isDeepStrictEqual(actual, expected)) {
          fail(`Expected ${format(actual)} to deeply equal ${format(expected)}`);
        }
      },
      toBeNull() {
        if (actual !== null) {
          fail(`Expected ${format(actual)} to be null`);
        }
      },
      toContain(expected) {
        if (actual == null || typeof actual.includes !== 'function' || !actual.includes(expected)) {
          fail(`Expected ${format(actual)} to contain ${format(expected)}`);
        }
      },
      toHaveLength(expected) {
        if (!actual || actual.length !== expected) {
          fail(`Expected length ${expected}, received ${actual ? actual.length : actual}`);
        }
      }
    };

    api.not = {
      toBe(expected) {
        if (actual === expected) {
          fail(`Expected ${format(actual)} not to be ${format(expected)}`);
        }
      },
      toEqual(expected) {
        if (isDeepStrictEqual(actual, expected)) {
          fail(`Expected ${format(actual)} not to deeply equal ${format(expected)}`);
        }
      },
      toBeNull() {
        if (actual === null) {
          fail('Expected value not to be null');
        }
      }
    };

    return api;
  };

  global.describe = registerSuite;
  global.it = registerTest;
  global.test = registerTest;
  global.beforeEach = registerBeforeEach;
  global.afterEach = registerAfterEach;
  global.expect = makeExpect;

  return rootSuite;
};

const runSuite = async (suite, ancestors, stats, failures) => {
  const chain = [...ancestors, suite];
  const names = chain.map(s => s.name).filter(Boolean);

  for (const test of suite.tests) {
    const beforeFns = chain.flatMap(s => s.beforeEach);
    const afterFns = chain.slice().reverse().flatMap(s => s.afterEach);
    const fullName = [...names, test.name].join(' › ');
    stats.total += 1;

    let error = null;
    try {
      for (const hook of beforeFns) {
        await hook();
      }
      await test.fn();
    } catch (err) {
      error = err;
    }

    try {
      for (const hook of afterFns) {
        await hook();
      }
    } catch (err) {
      if (!error) {
        error = err;
      }
    }

    if (error) {
      stats.failed += 1;
      failures.push({ name: fullName, error });
      console.error(`✕ ${fullName}`);
      console.error('   ', error.message);
    } else {
      stats.passed += 1;
      console.log(`✓ ${fullName}`);
    }
  }

  for (const child of suite.children) {
    await runSuite(child, chain, stats, failures);
  }
};

const runFile = async (file) => {
  const rel = path.relative(rootDir, file);
  console.log(`\nRunning ${rel}`);
  const suite = suitesForFile(rel);
  await import(pathToFileURL(file));

  const stats = { total: 0, passed: 0, failed: 0 };
  const failures = [];
  await runSuite(suite, [], stats, failures);
  return { stats, failures };
};

(async () => {
  const files = findTestFiles(testsDir);
  if (files.length === 0) {
    console.log('No test files found.');
    return;
  }

  let total = 0;
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const file of files) {
    const result = await runFile(file);
    total += result.stats.total;
    passed += result.stats.passed;
    failed += result.stats.failed;
    failures.push(...result.failures);
  }

  console.log(`\nTest Summary: ${passed}/${total} passed, ${failed} failed`);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
})();
