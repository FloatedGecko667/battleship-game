<script lang="ts">
	import type { Board } from '$lib/engine/board';
	import { cellIndex, isSunk } from '$lib/engine/board';
	import { cellsOf } from '$lib/engine/geometry';
	import { RANKS } from '$lib/engine/edition';
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
		label?: string;
		/** Hull class being positioned during deployment, highlighted on the board. */
		highlight?: ShipClass | null;
		/** Cells called but not yet answered, while a salvo is assembled. */
		pending?: readonly Coord[];
	}

	let {
		board,
		tone,
		revealShips,
		cursor = null,
		onFire,
		label,
		highlight = null,
		pending = []
	}: Props = $props();

	const pendingKeys = $derived(new Set(pending.map((c) => `${c.row},${c.col}`)));

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
	{#if label}<p class="label">{label}</p>{/if}

	<div class="frame" style="--cols:{cols}; --rows:{rows}">
		<div class="corner"></div>
		{#each Array(cols) as _, col (col)}
			<div class="file-head" style="grid-column:{col + 2}">{col + 1}</div>
		{/each}

		{#each Array(rows) as _, row (row)}
			<div class="rank-head" style="grid-row:{row + 2}">{RANKS[row]}</div>
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
						type="button"
						disabled={!onFire}
						style="grid-row:{row + 1}; grid-column:{col + 1}"
						aria-label={`${RANKS[row]}${col + 1}`}
						onclick={() => fire(row, col)}
					>
						{#if paint}<span class="hull" class:bow={paint.bow}>{paint.glyph}</span>{/if}
						{#if mark?.kind === 'miss'}<span class="pin miss">●</span>{/if}
						{#if mark?.kind === 'scan'}<span class="pin scan">●</span>{/if}
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

	.frame {
		display: grid;
		grid-template-columns: 1.4rem repeat(var(--cols), var(--cell));
		grid-template-rows: 1rem repeat(var(--rows), var(--cell));
	}

	.file-head,
	.rank-head {
		display: grid;
		place-items: center;
		font-size: 0.6rem;
		color: var(--text-dim);
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

	/* A called-but-unanswered salvo shot. */
	.cell.pending {
		background: color-mix(in srgb, var(--neon) 16%, transparent);
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
</style>
