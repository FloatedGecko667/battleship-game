import { describe, expect, it } from 'vitest';
import { BOW_GLYPH, codeOverlays } from './shipOverlay';
import type { Ship } from '$lib/engine/types';

describe('codeOverlays', () => {
	it('labels every cell behind the bow for a long hull', () => {
		const cv: Ship = { class: 'CV', bow: { row: 6, col: 6 }, facing: 'W' };
		const overlays = codeOverlays(cv);

		expect(overlays).toHaveLength(4); // 5 cells minus the bow
		expect(overlays.every((o) => o.text === 'CV')).toBe(true);
		expect(overlays.every((o) => o.rowSpan === 1 && o.colSpan === 1)).toBe(true);
		expect(overlays.map((o) => o.col)).toEqual([7, 8, 9, 10]);
	});

	it('gives PB a single label spanning both cells, bow included', () => {
		const horizontal = codeOverlays({ class: 'PB', bow: { row: 3, col: 5 }, facing: 'W' });
		expect(horizontal).toEqual([{ row: 3, col: 5, rowSpan: 1, colSpan: 2, text: 'PB' }]);

		const vertical = codeOverlays({ class: 'PB', bow: { row: 6, col: 13 }, facing: 'N' });
		expect(vertical).toEqual([{ row: 6, col: 13, rowSpan: 2, colSpan: 1, text: 'PB' }]);
	});

	it('anchors a stern-first PB at its top-left cell', () => {
		// Facing S means the hull runs upwards, so the bow is the lower cell.
		const overlays = codeOverlays({ class: 'PB', bow: { row: 6, col: 2 }, facing: 'S' });
		expect(overlays).toEqual([{ row: 5, col: 2, rowSpan: 2, colSpan: 1, text: 'PB' }]);
	});
});

describe('BOW_GLYPH', () => {
	it('points the way the ship faces', () => {
		expect(BOW_GLYPH).toEqual({ N: '▲', E: '▶', S: '▼', W: '◀' });
	});
});
