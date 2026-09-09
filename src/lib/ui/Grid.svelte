<script lang="ts">
	import type { Board } from '$lib/engine/board';
	import { cellIndex, isSunk } from '$lib/engine/board';
	import { cellsOf } from '$lib/engine/geometry';
	import { PHONETIC, RANKS, phoneticLabel } from '$lib/engine/edition';
	import type { Coord, FleetShip, ShipClass } from '$lib/engine/types';
	import { BOW_GLYPH, HULL_GLYPH, codeOverlays } from './shipOverlay';

	interface Props {
		board: Board;
		/** Drives the neon colour: your own waters are blue, the enemy's are red. */
		tone: 'ally' | 'enemy';
		/** Own board shows the whole fleet; the enemy's only shows what has been sunk. */
		revealShips: boolean;
		cursor?: Coord | null;
		onFire?: (coord: Coord) => void;
		/** Moves the reticle, so the aim preview tracks the pointer too. */
		onHover?: (coord: Coord) => void;
		label?: string;
		/** Hull class being positioned during deployment, highlighted on the board. */
		highlight?: ShipClass | null;
		/** Cells called but not yet answered, while a salvo is assembled. */
		pending?: readonly Coord[];
		/** Footprint of the weapon currently being aimed. */
		aim?: readonly Coord[];
		/** Aircraft to draw on this board, parked or hovering. */
		aircraft?: readonly Coord[];
		/** Marks this board as the one the armed weapon is asking for. */
		targeted?: boolean;
	}

	let {
		board,
		tone,
		revealShips,
		cursor = null,
		onFire,
		onHover,
		label,
		highlight = null,
		pending = [],
		aim = [],
		aircraft = [],
		targeted = false
	}: Props = $props();

	const pendingKeys = $derived(new Set(pending.map((c) => `${c.row},${c.col}`)));
	const aimKeys = $derived(new Set(aim.map((c) => `${c.row},${c.col}`)));
	const planeKeys = $derived(new Set(aircraft.map((c) => `${c.row},${c.col}`)));

	const cols = $derived(board.size.cols);
	const rows = $derived(board.size.rows);

	const visible = $derived<FleetShip[]>(
		revealShips ? board.ships : board.ships.filter(isSunk)
	);

	/** Cell index -> what to paint in the fill layer. */
	const fill = $derived.by(() => {
		const map = new Map<number, { glyph: string; bow: boolean; sunk: boolean; cls: ShipClass }>();
		for (const ship of visible) {
			const sunk = isSunk(ship);
			cellsOf(ship).forEach((cell, i) => {
				map.set(cellIndex(cell, board.size), {
					glyph: i === 0 ? BOW_GLYPH[ship.facing] : HULL_GLYPH,
					bow: i === 0,
					sunk,
					cls: ship.class
				});
			});
		}
		return map;
	});

	const overlays = $derived(
		visible.flatMap((ship) => codeOverlays(ship).map((o) => ({ ...o, sunk: isSunk(ship) })))
	);

	function fire(row: number, col: number) {
		onFire?.({ row, col });
	}
</script>

<div class="wrap" data-tone={tone}>
	{#if label}
		<p class="label" class:targeted>
			{label}{#if targeted}<span class="cue"> ◀ fire here</span>{/if}
		</p>
	{/if}

	<div class="frame" style="--cols:{cols}; --rows:{rows}">
		<div class="corner"></div>
		{#each Array(cols) as _, col (col)}
			<div class="file-head" style="grid-column:{col + 2}">{col + 1}</div>
		{/each}

		{#each Array(rows) as _, row (row)}
			<div class="rank-head" style="grid-row:{row + 2}">
				<span class="rank">{RANKS[row]}</span>
				<span class="phonetic">{PHONETIC[RANKS[row]]}</span>
			</div>
		{/each}

		<div class="board" style="grid-column:2/-1; grid-row:2/-1">
			{#each Array(rows) as _, row (row)}
				{#each Array(cols) as _, col (col)}
					{@const index = cellIndex({ row, col }, board.size)}
					{@const mark = board.marks[index]}
					{@const paint = fill.get(index)}
					<!-- Explicit placement: the code overlays below are explicitly placed too,
					     and auto-placed cells would otherwise flow around them. -->
					<button
						class="cell"
						class:cursor={cursor?.row === row && cursor?.col === col}
						class:sunk={paint?.sunk}
						class:selected={highlight !== null && paint?.cls === highlight}
						class:pending={pendingKeys.has(`${row},${col}`)}
						class:aimed={aimKeys.has(`${row},${col}`)}
						type="button"
						disabled={!onFire}
						style="grid-row:{row + 1}; grid-column:{col + 1}"
						aria-label={phoneticLabel(row, col)}
						onclick={() => fire(row, col)}
						onpointerenter={() => onHover?.({ row, col })}
					>
						{#if paint}<span class="hull" class:bow={paint.bow}>{paint.glyph}</span>{/if}
						{#if mark?.kind === 'miss'}<span class="pin miss">●</span>{/if}
						{#if mark?.kind === 'scan'}<span class="pin scan">●</span>{/if}
						{#if planeKeys.has(`${row},${col}`)}<span class="plane">◆</span>{/if}
						{#if pendingKeys.has(`${row},${col}`)}<span class="queued">◎</span>{/if}
						{#if mark?.kind === 'hit'}
							<span class="pin hit">●</span>
							<span class="cross">╳</span>
						{/if}
					</button>
				{/each}
			{/each}

			{#each overlays as overlay (`${overlay.row}:${overlay.col}:${overlay.text}`)}
				<span
					class="code"
					class:sunk={overlay.sunk}
					style="grid-row:{overlay.row + 1}/span {overlay.rowSpan};
					       grid-column:{overlay.col + 1}/span {overlay.colSpan}"
				>{overlay.text}</span>
			{/each}
		</div>
	</div>
</div>

<style>
	.wrap {
		--neon: var(--ally);
		--neon-glow: var(--ally-glow);
	}

	.wrap[data-tone='enemy'] {
		--neon: var(--enemy);
		--neon-glow: var(--enemy-glow);
	}

	.label {
		margin: 0 0 0.4rem;
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--neon);
	}

	.label.targeted {
		color: var(--enemy);
		text-shadow: 0 0 6px var(--enemy-glow);
	}

	.cue {
		letter-spacing: 0.08em;
	}

	.frame {
		display: grid;
		grid-template-columns: 1.4rem repeat(var(--cols), var(--cell));
		grid-template-rows: 1rem repeat(var(--rows), var(--cell));
	}

	.file-head,
	.rank-head {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		font-size: 0.6rem;
		color: var(--text-dim);
	}

	/* The NATO rank name only earns its gutter when there is room for it. */
	.phonetic {
		display: none;
		font-size: 0.52rem;
		letter-spacing: 0.08em;
	}

	.board {
		display: grid;
		grid-template-columns: repeat(var(--cols), var(--cell));
		grid-template-rows: repeat(var(--rows), var(--cell));
		border-top: 1px solid var(--rule-dim);
		border-left: 1px solid var(--rule-dim);
	}

	.cell {
		position: relative;
		display: grid;
		place-items: center;
		margin: 0;
		padding: 0;
		font: inherit;
		font-size: calc(var(--cell) * 0.62);
		line-height: 1;
		background: transparent;
		border: 0;
		border-right: 1px solid var(--rule-faint);
		border-bottom: 1px solid var(--rule-faint);
		color: var(--neon);
		cursor: pointer;
	}

	.cell:disabled {
		cursor: default;
	}

	.cell.cursor {
		outline: 1px solid var(--neon);
		outline-offset: -1px;
	}

	.cell.sunk {
		color: var(--sunk);
	}

	.hull {
		grid-area: 1 / 1;
		/* The block is a fill, not a label: dimmed so the white code reads over it. */
		opacity: 0.42;
		text-shadow: 0 0 4px var(--neon-glow);
	}

	/* Nothing is drawn over the bow, so it keeps full neon. */
	.hull.bow {
		opacity: 1;
		text-shadow: 0 0 4px var(--neon-glow), 0 0 10px var(--neon-glow);
	}

	/* Footprint of the weapon being aimed. */
	.cell.aimed {
		background: color-mix(in srgb, var(--enemy) 22%, transparent);
		outline: 1px solid var(--enemy-dim);
		outline-offset: -1px;
	}

	/* A called-but-unanswered salvo shot. */
	.cell.pending {
		background: color-mix(in srgb, var(--neon) 16%, transparent);
	}

	/* An aircraft, parked on the carrier or hovering over the water. */
	.plane {
		grid-area: 1 / 1;
		align-self: start;
		justify-self: end;
		padding: 1px 2px 0 0;
		font-size: calc(var(--cell) * 0.36);
		color: var(--code);
		text-shadow: 0 0 4px var(--neon-glow);
	}

	.queued {
		grid-area: 1 / 1;
		font-size: calc(var(--cell) * 0.55);
		color: var(--neon);
		text-shadow: 0 0 5px var(--neon-glow);
	}

	.cell.selected {
		background: color-mix(in srgb, var(--neon) 12%, transparent);
	}

	.pin,
	.cross {
		grid-area: 1 / 1;
		font-size: calc(var(--cell) * 0.5);
		line-height: 1;
	}

	.pin.miss {
		color: var(--rule);
	}

	/* Official blue SCAN pegs. Drawn small so it never reads as a hull fill. */
	.pin.scan {
		color: var(--ally);
		font-size: calc(var(--cell) * 0.34);
		text-shadow: 0 0 5px var(--ally-glow);
	}

	.pin.hit,
	.cross {
		color: var(--enemy);
		text-shadow: 0 0 5px var(--enemy-glow);
	}

	.cross {
		animation: strike 420ms ease-out 1;
	}

	@keyframes strike {
		from {
			transform: scale(2.4);
			opacity: 0;
		}
		60% {
			opacity: 1;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	.cell:focus-visible {
		outline: 2px solid var(--neon);
		outline-offset: -2px;
		z-index: 1;
	}

	.cross {
		font-size: calc(var(--cell) * 0.72);
	}

	/* Hull codes ride above the fill and must not eat the cell's clicks. */
	.code {
		display: grid;
		place-items: center;
		pointer-events: none;
		font-size: calc(var(--cell) * 0.42);
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--code);
		/* Keeps the label off the fill's neon bloom. */
		text-shadow: 0 0 3px #000, 0 0 6px #000;
	}

	.code.sunk {
		color: rgba(255, 255, 255, 0.4);
	}
	@media (min-width: 1200px) {
		.frame {
			grid-template-columns: 4.4rem repeat(var(--cols), var(--cell));
		}

		.rank-head {
			justify-content: flex-end;
			padding-right: 0.4rem;
		}

		.phonetic {
			display: inline;
		}
	}
</style>
