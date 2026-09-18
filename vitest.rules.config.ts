import { defineConfig } from 'vitest/config';

/**
 * Dedicated Vitest config for the Realtime Database security-rules suite.
 *
 * These tests talk to a live `firebase emulators` instance and are therefore
 * deliberately excluded from the default `vitest.config.ts` run (and from
 * `npm test`). Run them with `npm run test:rules`, which boots the database
 * emulator via `firebase emulators:exec`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    globals: false,
  },
});
