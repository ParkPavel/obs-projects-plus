/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  transform: {
    "^.+\\.ts$": "esbuild-jest",
    "^.+\\.svelte$": "svelte-jest",
  },
  moduleNameMapper: {
    "^src/(.*)$": "<rootDir>/src/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.(test|spec).(ts|js)",
    "<rootDir>/src/**/*.(test|spec).(ts|js)"
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,js}",
    "!src/**/*.d.ts",
    "!src/__tests__/**",
    "!src/**/*.test.{ts,js}",
    "!src/**/*.spec.{ts,js}",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  verbose: true,
  testTimeout: 10000,
};
