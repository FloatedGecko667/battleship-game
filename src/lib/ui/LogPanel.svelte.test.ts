import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LogPanel, { type LogLine } from './LogPanel.svelte';
import { i18n } from '$lib/i18n/index.svelte';

afterEach(() => i18n.set('en'));

const lines: LogLine[] = [
	{ id: 1, side: 'system', msg: { k: 'onStation' } },
	{ id: 2, side: 'player', msg: { k: 'shot', side: 'player', at: { row: 1, col: 4 }, hit: true } },
	{ id: 3, side: 'player', msg: { k: 'sunk', side: 'cpu', cls: 'SS' } }
];

describe('LogPanel', () => {
	it('words each entry in English by default', async () => {
		const screen = await render(LogPanel, { lines });
		await expect.element(screen.getByText('Salvo B5 — HIT')).toBeVisible();
		await expect.element(screen.getByText('Enemy Submarine is down (SS)')).toBeVisible();
	});

	it('re-reads the whole log when the language changes', async () => {
		const screen = await render(LogPanel, { lines });
		await expect.element(screen.getByText('Salvo B5 — HIT')).toBeVisible();

		i18n.set('ja');
		await expect.element(screen.getByText('砲撃 B5 — 命中')).toBeVisible();
		await expect.element(screen.getByText(/敵潜水艦（SS）撃沈/)).toBeVisible();
		expect(screen.container.textContent).not.toContain('Salvo');
	});

	it('marks who each line is about', async () => {
		const screen = await render(LogPanel, { lines });
		const markers = [...screen.container.querySelectorAll('.marker')].map((m) => m.textContent);
		expect(markers).toEqual(['#', '>', '>']);
	});

	it('is a polite live region, so screen readers hear new lines', async () => {
		const screen = await render(LogPanel, { lines });
		const log = screen.getByRole('log');
		await expect.element(log).toHaveAttribute('aria-live', 'polite');
	});
});
