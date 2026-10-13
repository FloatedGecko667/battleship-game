import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	// The specs read English copy; the Japanese spec switches language itself.
	use: { locale: 'en-US' },
	testMatch: '**/*.e2e.{ts,js}'
});
