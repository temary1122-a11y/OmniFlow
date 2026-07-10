import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    // Only the new `test/` suite (singular) is part of `npm test`.
    // The legacy `tests/` (plural) debug/other-agent folder is excluded.
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/**', '**/webview-ui/**'],
    // Per-test isolation: vitest restores all vi.* mocks/spies between
    // tests so a mock from one test can never leak into the next.
    restoreMocks: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      // Minimal `vscode` shim so pure src modules that transitively
      // import 'vscode' (e.g. SemanticEditor via ResearchAgent) load under
      // node without the extension host.
      vscode: resolve(__dirname, 'test/shims/vscode.ts'),
    },
  },
});
