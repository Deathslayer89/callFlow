/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 20000,
  maxWorkers: 1,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@callflow/shared/logger$': '<rootDir>/../shared/utils/logger.ts',
    '^@callflow/shared/schemas$': '<rootDir>/../shared/schemas.ts',
    '^@callflow/shared$': '<rootDir>/../shared/types/index.ts',
    '^@callflow/agent$': '<rootDir>/../agent/src/index.ts',
    '^@callflow/workflows$': '<rootDir>/../workflows/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          target: 'ES2022',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
          strict: false,
        },
        isolatedModules: true,
      },
    ],
  },
};
