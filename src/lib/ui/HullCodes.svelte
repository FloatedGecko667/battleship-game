<script lang="ts">
	import { fleetFor } from '$lib/engine/fleet';
	import type { Edition } from '$lib/engine/edition';
	import { isSunk, type Board } from '$lib/engine/board';
	import { i18n } from '$lib/i18n/index.svelte';
	import Panel from './Panel.svelte';

	interface Props {
		/** Own board, so damage counts can be shown. */
		board: Board;
		edition: Edition;
	}

	let { board, edition }: Props = $props();

	const rows = $derived(
		fleetFor(edition).map((spec) => {
			const ship = board.ships.find((s) => s.class === spec.class);
			const hits = ship ? ship.hits.filter(Boolean).length : 0;
			return { spec, hits, down: ship ? isSunk(ship) : false };
		})
	);
	const t = $derived(i18n.t.hullCodes);
</script>

<Panel title={t.title}>
	<table>
		<thead>
			<tr><th>{t.code}</th><th>{t.ship}</th><th>{t.length}</th><th>{t.status}</th></tr>
		</thead>
		<tbody>
			{#each rows as row (row.spec.class)}
				<tr class:down={row.down}>
					<td class="code">{row.spec.code}</td>
					<td>{i18n.t.ships[row.spec.class]}</td>
					<td class="num">{row.spec.length}</td>
					<td class="num">{row.down ? t.sunk : `${row.hits}/${row.spec.length}`}</td>
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
