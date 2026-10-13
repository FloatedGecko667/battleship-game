import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HullCodes from './HullCodes.svelte';
import { createBoard, type Board } from '$lib/engine/board';
import { boardSize } from '$lib/engine/edition';
import { fleetClasses } from '$lib/engine/fleet';
import { randomFleet } from '$lib/engine/placement';
import { mulberry32 } from '$lib/engine/rng';
import { i18n } from '$lib/i18n/index.svelte';

afterEach(() => i18n.set('en'));

function boardFor(edition: 'CLASSIC' | 'DELUXE'): Board {
	const size = boardSize(edition);
	return createBoard(size, randomFleet(size, mulberry32(1), fleetClasses(edition)));
}

const codes = (container: HTMLElement) =>
	[...container.querySelectorAll('td.code')].map((cell) => cell.textContent);

describe('HullCodes', () => {
	it('lists the 1990 fleet, submarine included, on CLASSIC', async () => {
		const screen = await render(HullCodes, { board: boardFor('CLASSIC'), edition: 'CLASSIC' });
		expect(codes(screen.container)).toEqual(['CV', 'BB', 'CA', 'SS', 'DD']);
		await expect.element(screen.getByText('Submarine')).toBeVisible();
	});

	it('lists the rulebook fleet on DELUXE', async () => {
		const screen = await render(HullCodes, { board: boardFor('DELUXE'), edition: 'DELUXE' });
		expect(codes(screen.container)).toEqual(['CV', 'BB', 'DD', 'DE', 'PB']);
	});

	it('reports damage and sinkings from the board', async () => {
		const board = boardFor('CLASSIC');
		board.ships[4].hits.fill(true); // the two-cell destroyer
		board.ships[0].hits[0] = true;

		const screen = await render(HullCodes, { board, edition: 'CLASSIC' });
		const status = [...screen.container.querySelectorAll('tbody tr')].map(
			(row) => row.querySelectorAll('td')[3].textContent
		);
		expect(status).toEqual(['1/5', '0/4', '0/3', '0/3', 'SUNK']);
	});

	it('names the ships in the current language', async () => {
		i18n.set('ja');
		const screen = await render(HullCodes, { board: boardFor('CLASSIC'), edition: 'CLASSIC' });
		await expect.element(screen.getByText('潜水艦')).toBeVisible();
		await expect.element(screen.getByRole('heading', { name: '艦種コード' })).toBeVisible();
		// The codes themselves are not translated.
		expect(codes(screen.container)).toContain('SS');
	});
});
