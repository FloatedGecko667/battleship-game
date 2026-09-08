import type { Coord } from '../types';
import type { Board } from '../board';
import type { Rng } from '../rng';
import { densityMap } from './density';
import { viewOf, type TargetView } from './view';
import {
	availableWeapons,
	type Arsenal,
	type WeaponUse
} from '../weapons/index';
import { block3x3, homingLane, launchCells, line3, type Orientation } from '../weapons/patterns';

/** Sum of the density map over a set of cells. */
function score(map: number[], view: TargetView, cells: Coord[]): number {
	return cells.reduce((sum, cell) => sum + map[cell.row * view.size.cols + cell.col], 0);
}

/**
 * Picks a special weapon when one clearly beats a plain shot, and otherwise
 * returns null so the caller falls back to firing normally.
 *
 * The battleship's single missile is held back until the map is genuinely
 * concentrated: spending it on a flat map wastes the best weapon in the fleet.
 */
export function chooseWeapon(
	target: Board,
	ownBoard: Board,
	arsenal: Arsenal,
	rng: Rng
): WeaponUse | null {
	const view = viewOf(target);
	const map = densityMap(view);
	const best = Math.max(...map);
	if (best <= 0) return null;

	const usable = new Set(availableWeapons(ownBoard, arsenal).map((w) => w.id));
	let choice: { use: WeaponUse; value: number } | null = null;

	const consider = (use: WeaponUse, cells: Coord[], value: number) => {
		if (!cells.length) return;
		if (!choice || value > choice.value) choice = { use, value };
	};

	if (usable.has('DD_MISSILE')) {
		for (const orientation of ['H', 'V'] as Orientation[]) {
			for (let row = 0; row < view.size.rows; row++) {
				for (let col = 0; col < view.size.cols; col++) {
					const at = { row, col };
					const cells = line3(at, orientation, view.size);
					consider({ weapon: 'DD_MISSILE', at, orientation }, cells, score(map, view, cells));
				}
			}
		}
	}

	if (usable.has('DE_HOMING')) {
		for (const orientation of ['H', 'V'] as Orientation[]) {
			for (const at of launchCells(orientation, view.size)) {
				const lane = homingLane(at, orientation, view.size);
				// Only the leading stretch is likely to matter, since the missile
				// stops at the first ship it meets.
				const reach = lane.slice(0, Math.ceil(lane.length / 2));
				consider({ weapon: 'DE_HOMING', at, orientation }, lane, score(map, view, reach) * 0.6);
			}
		}
	}

	if (usable.has('BB_MISSILE')) {
		for (let row = 0; row < view.size.rows; row++) {
			for (let col = 0; col < view.size.cols; col++) {
				const at = { row, col };
				const cells = block3x3(at, view.size);
				const value = score(map, view, cells);
				// Worth the one round only when it beats three plain shots.
				if (value > best * 3) consider({ weapon: 'BB_MISSILE', at }, cells, value);
			}
		}
	}

	if (!choice) return null;

	// A plain shot is already worth `best`; only trade the turn for more.
	const picked = choice as { use: WeaponUse; value: number };
	return picked.value > best ? picked.use : null;
}
