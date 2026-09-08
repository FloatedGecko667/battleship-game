<script lang="ts">
	import { isSunk, survivingShips, type Board } from '$lib/engine/board';
	import { FLEET_CELLS } from '$lib/engine/fleet';
	import Panel from './Panel.svelte';

	interface Props {
		board: Board;
		title: string;
		tone: 'ally' | 'enemy';
	}

	let { board, title, tone }: Props = $props();

	const afloat = $derived(survivingShips(board).length);
	const hits = $derived(board.ships.reduce((n, s) => n + s.hits.filter(Boolean).length, 0));
</script>

<Panel {title} {tone}>
	<p class="stat">
		<span class="big">{afloat}</span><span class="of">/{board.ships.length}</span> afloat
	</p>
	<p class="stat dim">{hits}/{FLEET_CELLS} hull cells hit</p>
	<ul>
		{#each board.ships as ship (ship.class)}
			<li class:down={isSunk(ship)}>
				<span class="code">{ship.class}</span>
				<span class="bar" aria-hidden="true">
					{#each ship.hits as hit, i (i)}<span class="seg" class:hit>▬</span>{/each}
				</span>
			</li>
		{/each}
	</ul>
</Panel>

<style>
	.stat {
		margin: 0 0 0.2rem;
		font-size: 0.72rem;
	}

	.big {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.of {
		color: var(--text-dim);
	}

	.dim {
		color: var(--text-dim);
		margin-bottom: 0.5rem;
	}

	ul {
		display: grid;
		gap: 0.15rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.7rem;
	}

	.code {
		width: 2ch;
		font-weight: 700;
		color: var(--code);
	}

	li.down .code {
		color: var(--sunk);
	}

	.seg {
		color: var(--rule-faint);
	}

	.seg.hit {
		color: var(--enemy);
	}
</style>
