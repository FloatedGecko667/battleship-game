import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Grid from './Grid.svelte';
import { createBoard } from '$lib/engine/board';
import { fireAt } from '$lib/engine/resolve';
import { boardSize } from '$lib/engine/edition';
import type { Ship } from '$lib/engine/types';

const SIZE = boardSize('CLASSIC');

function boardWith(ships: Ship[]) {
	return createBoard(SIZE, ships);
}

describe('Grid', () => {
	it('draws a bow glyph and block fill for a long hull, with the code behind the bow', async () => {
		const board = boardWith([{ class: 'CA', bow: { row: 2, col: 2 }, facing: 'W' }]);
		const screen = await render(Grid, { board, tone: 'ally', revealShips: true });

		const glyphs = [...screen.container.querySelectorAll('.hull')].map((el) => el.textContent);
		expect(glyphs).toEqual(['◀', '▓', '▓']);
		const codes = [...screen.container.querySelectorAll('.code')].map((el) => el.textContent);
		expect(codes).toEqual(['CA', 'CA']);
	});

	it('spans the two-cell CLASSIC destroyer with a single DD label', async () => {
		const board = boardWith([{ class: 'DD2', bow: { row: 0, col: 0 }, facing: 'W' }]);
		const screen = await render(Grid, { board, tone: 'ally', revealShips: true });

		const labels = screen.container.querySelectorAll('.code');
		expect(labels).toHaveLength(1);
		expect(labels[0].textContent).toBe('DD');
		expect((labels[0] as HTMLElement).style.gridColumn).toContain('span 2');
	});

	it('overlays a cross on a hit and a plain pin on a miss', async () => {
		const board = boardWith([{ class: 'CA', bow: { row: 0, col: 0 }, facing: 'W' }]);
		fireAt(board, { row: 0, col: 0 });
		fireAt(board, { row: 5, col: 5 });

		const screen = await render(Grid, { board, tone: 'enemy', revealShips: false });
		expect(screen.container.querySelectorAll('.pin.hit')).toHaveLength(1);
		expect(screen.container.querySelectorAll('.cross')).toHaveLength(1);
		expect(screen.container.querySelectorAll('.pin.miss')).toHaveLength(1);
	});

	it('keeps the enemy fleet hidden until a ship is sunk', async () => {
		const board = boardWith([{ class: 'DD2', bow: { row: 0, col: 0 }, facing: 'W' }]);
		const hidden = await render(Grid, { board, tone: 'enemy', revealShips: false });
		expect(hidden.container.querySelectorAll('.hull')).toHaveLength(0);

		fireAt(board, { row: 0, col: 0 });
		fireAt(board, { row: 0, col: 1 });
		const revealed = await render(Grid, { board, tone: 'enemy', revealShips: false });
		expect(revealed.container.querySelectorAll('.hull')).toHaveLength(2);
		expect(revealed.container.querySelector('.code')?.textContent).toBe('DD');
	});

	it('sizes itself from the board, so DELUXE gets fourteen files', async () => {
		const deluxe = createBoard(boardSize('DELUXE'), []);
		const screen = await render(Grid, { board: deluxe, tone: 'ally', revealShips: true });
		expect(screen.container.querySelectorAll('.file-head')).toHaveLength(14);
		expect(screen.container.querySelectorAll('.cell')).toHaveLength(140);
	});

	it('points at the board that the armed weapon wants', async () => {
		const screen = await render(Grid, {
			board: boardWith([]),
			tone: 'enemy',
			revealShips: false,
			label: 'Enemy waters',
			targeted: true
		});
		await expect.element(screen.getByText('◀ fire here')).toBeVisible();
	});
});
