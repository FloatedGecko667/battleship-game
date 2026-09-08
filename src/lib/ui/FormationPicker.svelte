<script lang="ts">
	import { FORMATIONS, FORMATION_IDS, type FormationId } from '$lib/data/formations';
	import { boardSize } from '$lib/engine/edition';
	import { cellsOf, coordKey } from '$lib/engine/geometry';
	import Panel from './Panel.svelte';

	interface Props {
		selected: FormationId | null;
		onPick: (id: FormationId) => void;
	}

	let { selected, onPick }: Props = $props();
	let typed = $state('');

	const size = boardSize('DELUXE');

	/** Occupied cells of a formation, for the thumbnail. */
	function occupied(id: FormationId) {
		return new Set(FORMATIONS[id].ships.flatMap(cellsOf).map(coordKey));
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const id = typed.trim().toUpperCase() as FormationId;
		if (FORMATION_IDS.includes(id)) onPick(id);
	}
</script>

<Panel title="Formations">
	<form onsubmit={submit}>
		<label>
			Code
			<input bind:value={typed} placeholder="A1" maxlength="3" size="4" />
		</label>
		<button type="submit">Deploy</button>
	</form>

	<div class="grid" role="listbox" aria-label="Rulebook formations">
		{#each FORMATION_IDS as id (id)}
			{@const cells = occupied(id)}
			<button
				type="button"
				class="thumb"
				class:on={selected === id}
				role="option"
				aria-selected={selected === id}
				title={id}
				onclick={() => onPick(id)}
			>
				<span class="code">{id}</span>
				<svg viewBox="0 0 {size.cols} {size.rows}" aria-hidden="true">
					{#each Array(size.rows) as _, row (row)}
						{#each Array(size.cols) as _, col (col)}
							{#if cells.has(`${row},${col}`)}
								<rect x={col} y={row} width="1" height="1" />
							{/if}
						{/each}
					{/each}
				</svg>
			</button>
		{/each}
	</div>
</Panel>

<style>
	form {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		font-size: 0.7rem;
	}

	input {
		background: transparent;
		border: 1px solid var(--rule-faint);
		color: var(--text);
		font: inherit;
		padding: 0.15rem 0.3rem;
		text-transform: uppercase;
	}

	button {
		border: 1px solid var(--rule-faint);
		background: transparent;
		color: var(--ally);
		font: inherit;
		font-size: 0.68rem;
		padding: 0.15rem 0.5rem;
		cursor: pointer;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
		gap: 0.25rem;
		max-height: 13rem;
		overflow-y: auto;
	}

	.thumb {
		display: grid;
		gap: 1px;
		padding: 0.15rem;
		justify-items: center;
	}

	.thumb.on {
		border-color: var(--ally);
		box-shadow: 0 0 6px var(--ally-glow);
	}

	.code {
		font-size: 0.55rem;
		letter-spacing: 0.08em;
		color: var(--text-dim);
	}

	.thumb.on .code {
		color: var(--ally);
	}

	svg {
		width: 100%;
		height: auto;
		background: #000;
		outline: 1px solid var(--rule-faint);
	}

	rect {
		fill: var(--ally);
	}
</style>
