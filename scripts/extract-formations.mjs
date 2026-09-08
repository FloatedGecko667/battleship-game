#!/usr/bin/env node
/**
 * Reads the 100 deployment formations out of the official rulebook (pp. 18-27)
 * and writes src/lib/data/formations.ts.
 *
 * Run once, by hand, and commit the output - the build must not depend on the
 * PDF, which is copyrighted and therefore not in the repository.
 *
 *   pdftoppm -r 200 -f 18 -l 27 docs/<rulebook>.pdf /tmp/fm
 *   node scripts/extract-formations.mjs /tmp/fm-{18..27}.ppm
 *
 * The diagrams colour-code everything needed: a red hull is the destroyer, a
 * blue one the escort, grey ones are told apart by length, and the two aircraft
 * sit on the five-cell carrier in red and blue. The pointed end is the bow.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const COLS = 14;
const ROWS = 10;
const RANKS = 'ABCDEFGHIJ';

// Measured off the rendered pages.
const TEAL = [43, 185, 200];
const GRID_LINE = [
	[74, 195, 210],
	[60, 180, 195]
];
const HULL = {
	G: [158, 156, 157],
	R: [237, 25, 46],
	B: [14, 136, 211]
};

function readPpm(path) {
	const buf = readFileSync(path);
	// P6\n<w> <h>\n<max>\n
	let offset = 0;
	const token = () => {
		while (buf[offset] === 0x20 || buf[offset] === 0x0a || buf[offset] === 0x09) offset++;
		const start = offset;
		while (offset < buf.length && ![0x20, 0x0a, 0x09].includes(buf[offset])) offset++;
		return buf.toString('ascii', start, offset);
	};
	const magic = token();
	if (magic !== 'P6') throw new Error(`${path}: not a binary PPM`);
	const width = Number(token());
	const height = Number(token());
	token(); // maxval
	offset++; // single whitespace before the raster
	return { width, height, data: buf.subarray(offset) };
}

const near = (c, target, tol) =>
	Math.abs(c[0] - target[0]) < tol &&
	Math.abs(c[1] - target[1]) < tol &&
	Math.abs(c[2] - target[2]) < tol;

/** Teal water. The green channel is what separates it from the blue hull. */
const isWater = (c) => c[2] > 140 && c[1] > 160 && c[0] < 140;
const isGridLine = (c) => GRID_LINE.some((g) => near(c, g, 12));

function pixelAt(img, x, y) {
	const i = ((y | 0) * img.width + (x | 0)) * 3;
	return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

/** Contiguous index ranges where the mask exceeds a threshold. */
function bands(values, threshold, minRun) {
	const out = [];
	let start = null;
	values.forEach((v, i) => {
		if (v > threshold && start === null) start = i;
		else if (v <= threshold && start !== null) {
			if (i - start >= minRun) out.push([start, i - 1]);
			start = null;
		}
	});
	if (start !== null && values.length - start >= minRun) out.push([start, values.length - 1]);
	return out;
}

/** The ten teal panels on a page, in reading order. */
function findPanels(img) {
	const colMask = [];
	for (let x = 0; x < img.width; x++) {
		let n = 0;
		for (let y = 0; y < img.height; y += 2) if (isWater(pixelAt(img, x, y))) n++;
		colMask.push(n);
	}
	const rowMask = [];
	for (let y = 0; y < img.height; y++) {
		let n = 0;
		for (let x = 0; x < img.width; x += 2) if (isWater(pixelAt(img, x, y))) n++;
		rowMask.push(n);
	}

	const cols = bands(colMask, 20, 20);
	const rows = bands(rowMask, 20, 20);
	if (cols.length !== 2 || rows.length !== 5) {
		throw new Error(`expected a 2x5 panel layout, found ${cols.length}x${rows.length}`);
	}

	const panels = [];
	for (const [y0, y1] of rows) {
		for (const [x0, x1] of cols) panels.push({ x0, x1, y0, y1 });
	}
	return panels;
}

/** Cell centres, from the lighter grid lines drawn between cells. */
function latticeOf(img, panel) {
	const line = (fixedRange, scanRange, horizontal) => {
		const hits = [];
		for (const a of fixedRange) {
			let n = 0;
			for (const b of scanRange) {
				const c = horizontal ? pixelAt(img, a, b) : pixelAt(img, b, a);
				if (isGridLine(c)) n++;
			}
			hits.push(n);
		}
		return hits;
	};

	const xs = [];
	for (let x = panel.x0; x <= panel.x1; x++) xs.push(x);
	const ys = [];
	for (let y = panel.y0; y <= panel.y1; y++) ys.push(y);

	const colHits = line(xs, ys, true);
	const rowHits = line(ys, xs, false);

	const cluster = (hits, base, threshold) =>
		bands(hits, threshold, 1).map(([a, b]) => base + (a + b) / 2);

	const colLines = cluster(colHits, panel.x0, (panel.y1 - panel.y0) * 0.3);
	const rowLines = cluster(rowHits, panel.y0, (panel.x1 - panel.x0) * 0.3);
	if (colLines.length < 2 || rowLines.length < 2) throw new Error('no grid lines found');

	// The outermost lines can be lost against the panel edge, so anchor on the
	// first line found and step by the measured pitch.
	const colPitch = (colLines[colLines.length - 1] - colLines[0]) / (colLines.length - 1);
	const rowPitch = (rowLines[rowLines.length - 1] - rowLines[0]) / (rowLines.length - 1);

	return {
		x0: colLines[0],
		y0: rowLines[0],
		colPitch,
		rowPitch,
		centre: (col, row) => ({
			x: colLines[0] + colPitch * (col + 0.5),
			y: rowLines[0] + rowPitch * (row + 0.5)
		})
	};
}

/** What a cell is painted with: water, or grey / red / blue hull. */
function classify(img, lattice, col, row) {
	const { x, y } = lattice.centre(col, row);
	const tally = { '.': 0, G: 0, R: 0, B: 0 };
	for (let dy = -4; dy <= 4; dy++) {
		for (let dx = -4; dx <= 4; dx++) {
			const c = pixelAt(img, x + dx, y + dy);
			if (isWater(c)) tally['.']++;
			else {
				for (const [key, target] of Object.entries(HULL)) {
					if (near(c, target, 55)) {
						tally[key]++;
						break;
					}
				}
			}
		}
	}
	for (const key of ['R', 'B', 'G']) if (tally[key] > 6) return key;
	return '.';
}

/**
 * The bow is the tapered end. Measured across the hull, the outer edge of the
 * bow cell is visibly thinner than the outer edge of the square stern.
 */
function outerThickness(img, lattice, col, row, axis, sign) {
	const { x, y } = lattice.centre(col, row);
	const span = Math.round((axis === 'h' ? lattice.rowPitch : lattice.colPitch) * 0.85);
	const step = Math.round((axis === 'h' ? lattice.colPitch : lattice.rowPitch) * 0.42) * sign;

	let n = 0;
	for (let d = -span; d <= span; d++) {
		const c =
			axis === 'h' ? pixelAt(img, x + step, y + d) : pixelAt(img, x + d, y + step);
		if (!isWater(c)) n++;
	}
	return n;
}

/**
 * Splits the painted cells into the five ships.
 *
 * Connected components are not enough: ships in these diagrams often touch, and
 * two hulls end to end look like one long run. The fleet is fixed, though, and
 * so is what each hull is painted with, so this searches for the one way the
 * cells can be covered exactly.
 */
const FLEET_PLAN = [
	{ class: 'CV', length: 5, needs: { G: 3, R: 1, B: 1 } },
	{ class: 'BB', length: 4, needs: { G: 4 } },
	{ class: 'DD', length: 3, needs: { R: 3 } },
	{ class: 'DE', length: 3, needs: { B: 3 } },
	{ class: 'PB', length: 2, needs: { G: 2 } }
];

/**
 * Whether two neighbouring painted cells belong to the same hull.
 *
 * Two ships lying end to end look like one long run, but the gap between their
 * capsules still shows water; inside a hull the paint is continuous.
 */
function hullLinks(img, lattice, cells) {
	const right = [];
	const down = [];
	for (let row = 0; row < ROWS; row++) {
		right.push(new Array(COLS).fill(false));
		down.push(new Array(COLS).fill(false));
	}

	const joined = (a, b, across) => {
		let hull = 0;
		for (let d = -5; d <= 5; d++) {
			const c = across === 'v' ? pixelAt(img, (a.x + b.x) / 2, a.y + d) : pixelAt(img, a.x + d, (a.y + b.y) / 2);
			if (!isWater(c)) hull++;
		}
		return hull > 7;
	};

	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			if (cells[row][col] === '.') continue;
			if (col + 1 < COLS && cells[row][col + 1] !== '.') {
				right[row][col] = joined(lattice.centre(col, row), lattice.centre(col + 1, row), 'v');
			}
			if (row + 1 < ROWS && cells[row + 1][col] !== '.') {
				down[row][col] = joined(lattice.centre(col, row), lattice.centre(col, row + 1), 'h');
			}
		}
	}
	return { right, down };
}

function runsOfLength(cells, links, taken, length) {
	const out = [];
	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			for (const [dc, dr] of [
				[1, 0],
				[0, 1]
			]) {
				if (col + dc * (length - 1) >= COLS || row + dr * (length - 1) >= ROWS) continue;
				const group = [];
				let ok = true;
				for (let i = 0; i < length; i++) {
					const c = col + dc * i;
					const r = row + dr * i;
					if (cells[r][c] === '.' || taken.has(`${c},${r}`)) {
						ok = false;
						break;
					}
					// A run may not cross the gap between two separate hulls.
					if (i > 0) {
						const pc = c - dc;
						const pr = r - dr;
						if (!(dc === 1 ? links.right[pr][pc] : links.down[pr][pc])) {
							ok = false;
							break;
						}
					}
					group.push({ col: c, row: r });
				}
				if (ok) out.push({ group, horizontal: dc === 1 });
			}
		}
	}
	return out;
}

function matchesPaint(cells, group, needs) {
	const tally = { G: 0, R: 0, B: 0 };
	for (const cell of group) tally[cells[cell.row][cell.col]]++;
	return Object.entries(needs).every(([paint, n]) => tally[paint] === n) &&
		Object.entries(tally).every(([paint, n]) => n === (needs[paint] ?? 0));
}

/** Every exact cover of the painted cells by the fleet; normally exactly one. */
function solveFleet(cells, links) {
	const painted = [];
	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			if (cells[row][col] !== '.') painted.push(`${col},${row}`);
		}
	}

	const solutions = [];
	const taken = new Set();
	const chosen = [];

	const step = (index) => {
		if (solutions.length > 1) return; // ambiguous already; stop early
		if (index === FLEET_PLAN.length) {
			if (taken.size === painted.length) solutions.push(chosen.map((c) => ({ ...c })));
			return;
		}
		const plan = FLEET_PLAN[index];
		for (const { group, horizontal } of runsOfLength(cells, links, taken, plan.length)) {
			if (!matchesPaint(cells, group, plan.needs)) continue;
			for (const cell of group) taken.add(`${cell.col},${cell.row}`);
			chosen.push({ class: plan.class, group, horizontal });
			step(index + 1);
			chosen.pop();
			for (const cell of group) taken.delete(`${cell.col},${cell.row}`);
		}
	};

	step(0);
	return solutions;
}

function readFormation(img, panel) {
	const lattice = latticeOf(img, panel);
	const cells = [];
	for (let row = 0; row < ROWS; row++) {
		const line = [];
		for (let col = 0; col < COLS; col++) line.push(classify(img, lattice, col, row));
		cells.push(line);
	}

	const ships = [];
	const aircraft = [];
	const problems = [];

	const solutions = solveFleet(cells, hullLinks(img, lattice, cells));
	if (solutions.length === 0) problems.push('no fleet covers the painted cells');
	else if (solutions.length > 1) problems.push('more than one fleet fits the painted cells');

	for (const ship of solutions[0] ?? []) {
		const group = [...ship.group].sort((a, b) =>
			ship.horizontal ? a.col - b.col : a.row - b.row
		);

		if (ship.class === 'CV') {
			for (const cell of group) {
				if (cells[cell.row][cell.col] !== 'G') aircraft.push(cell);
			}
		}

		const axis = ship.horizontal ? 'h' : 'v';
		const head = group[0];
		const tail = group[group.length - 1];
		const bowAtHead =
			outerThickness(img, lattice, head.col, head.row, axis, -1) <
			outerThickness(img, lattice, tail.col, tail.row, axis, +1);
		const bow = bowAtHead ? head : tail;

		ships.push({
			class: ship.class,
			bow: { row: bow.row, col: bow.col },
			facing: ship.horizontal ? (bowAtHead ? 'W' : 'E') : bowAtHead ? 'N' : 'S'
		});
	}

	return { ships, aircraft, problems, cells };
}

function validate(formation) {
	const problems = [...formation.problems];
	const classes = formation.ships.map((s) => s.class).sort();
	if (classes.join(',') !== 'BB,CV,DD,DE,PB') {
		problems.push(`fleet is ${classes.join(',') || 'empty'}`);
	}
	if (formation.aircraft.length !== 2) {
		problems.push(`${formation.aircraft.length} aircraft, expected 2`);
	}
	return problems;
}

const label = (row, col) => `${RANKS[row]}${col + 1}`;

function main() {
	const files = process.argv.slice(2);
	if (files.length !== 10) {
		console.error('usage: extract-formations.mjs <ten .ppm pages, 18 through 27>');
		process.exit(1);
	}

	const formations = {};
	let failures = 0;

	files.forEach((file, page) => {
		const img = readPpm(file);
		findPanels(img).forEach((panel, index) => {
			const id = `${RANKS[page]}${index + 1}`;
			const formation = readFormation(img, panel);
			const problems = validate(formation);
			if (problems.length) {
				failures++;
				console.error(`${id}: ${problems.join('; ')}`);
				for (const line of formation.cells) console.error(`    ${line.join('')}`);
			}
			formations[id] = formation;
		});
	});

	const body = Object.entries(formations)
		.map(([id, f]) => {
			const ships = f.ships
				.map((s) => `{ class: '${s.class}', bow: { row: ${s.bow.row}, col: ${s.bow.col} }, facing: '${s.facing}' }`)
				.join(',\n\t\t\t');
			const planes = f.aircraft
				.map((a) => `{ row: ${a.row}, col: ${a.col} }`)
				.join(', ');
			return `\t${id}: {\n\t\tships: [\n\t\t\t${ships}\n\t\t],\n\t\taircraft: [${planes}]\n\t}`;
		})
		.join(',\n');

	const source = `// Generated by scripts/extract-formations.mjs from the official rulebook pp. 18-27.
// Do not edit by hand; re-run the extractor instead.
import type { Coord, Ship } from '$lib/engine/types';

export interface Formation {
	ships: Ship[];
	/** Deck cells the two aircraft occupy. */
	aircraft: Coord[];
}

export type FormationId = keyof typeof FORMATIONS;

export const FORMATIONS = {
${body}
} as const satisfies Record<string, Formation>;

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];
`;

	writeFileSync('src/lib/data/formations.ts', source);
	console.log(`wrote ${Object.keys(formations).length} formations, ${failures} needing review`);

	const a1 = formations.A1;
	if (a1) {
		console.log('A1 read as:');
		for (const s of a1.ships) console.log(`  ${s.class} bow ${label(s.bow.row, s.bow.col)} facing ${s.facing}`);
		console.log(`  aircraft ${a1.aircraft.map((a) => label(a.row, a.col)).join(', ')}`);
	}
}

main();
