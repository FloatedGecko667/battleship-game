<script lang="ts">
	import { FLEET } from '$lib/engine/fleet';
	import { isSunk, type Board } from '$lib/engine/board';
	import Panel from './Panel.svelte';

	interface Props {
		/** Own board, so damage counts can be shown. */
		board: Board;
	}

	let { board }: Props = $props();

	const rows = $derived(
		FLEET.map((spec) => {
			const ship = board.ships.find((s) => s.class === spec.class);
			const hits = ship ? ship.hits.filter(Boolean).length : 0;
			return { spec, hits, down: ship ? isSunk(ship) : false };
		})
	);
</script>

<Panel title="Hull Codes">
	<table>
		<thead>
			<tr><th>Code</th><th>Ship</th><th>Len</th><th>Status</th></tr>
		</thead>
		<tbody>
			{#each rows as row (row.spec.class)}
				<tr class:down={row.down}>
					<td class="code">{row.spec.class}</td>
					<td>{row.spec.name}</td>
					<td class="num">{row.spec.length}</td>
					<td class="num">{row.down ? 'SUNK' : `${row.hits}/${row.spec.length}`}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</Panel>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.72rem;
	}

	th {
		text-align: left;
		font-weight: 400;
		color: var(--text-dim);
		border-bottom: 1px solid var(--rule-faint);
		padding-bottom: 0.2rem;
	}

	td {
		padding: 0.15rem 0.4rem 0.15rem 0;
	}

	.code {
		font-weight: 700;
		color: var(--code);
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	tr.down {
		color: var(--sunk);
	}

	tr.down .code {
		color: var(--sunk);
	}
</style>
