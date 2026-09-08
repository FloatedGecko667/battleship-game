<script lang="ts">
	import type { FleetShip } from '$lib/engine/types';
	import type { Heading } from '$lib/engine/movement';
	import { shipSpec } from '$lib/engine/fleet';
	import Panel from './Panel.svelte';

	interface Props {
		/** Undamaged ships with somewhere to go. */
		ships: FleetShip[];
		selected: number;
		onSelect: (index: number) => void;
		onSteer: (heading: Heading) => void;
		canSteer: (heading: Heading) => boolean;
	}

	let { ships, selected, onSelect, onSteer, canSteer }: Props = $props();
</script>

<Panel title="Helm" tone="ally">
	{#if ships.length === 0}
		<p class="none">Nothing can get under way. Damaged ships hold their position.</p>
	{:else}
		<ul>
			{#each ships as ship, index (ship.class)}
				<li>
					<button
						type="button"
						class:on={selected === index}
						onclick={() => onSelect(index)}
					>
						<span class="code">{ship.class}</span>
						<span class="name">{shipSpec(ship.class).name}</span>
					</button>
				</li>
			{/each}
		</ul>

		<div class="steer">
			<button type="button" disabled={!canSteer('astern')} onclick={() => onSteer('astern')}>
				◀ Astern
			</button>
			<button type="button" disabled={!canSteer('ahead')} onclick={() => onSteer('ahead')}>
				Ahead ▶
			</button>
		</div>
		<p class="note">Moving is the turn's action — you do not also fire.</p>
	{/if}
</Panel>

<style>
	ul {
		display: grid;
		gap: 0.2rem;
		margin: 0 0 0.5rem;
		padding: 0;
		list-style: none;
	}

	button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		border: 1px solid var(--rule-faint);
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 0.72rem;
		padding: 0.2rem 0.4rem;
		cursor: pointer;
		text-align: left;
	}

	button.on {
		border-color: var(--ally);
		color: var(--ally);
	}

	button:disabled {
		color: var(--text-dim);
		cursor: default;
	}

	.code {
		font-weight: 700;
		width: 2ch;
	}

	.steer {
		display: flex;
		gap: 0.4rem;
	}

	.steer button {
		justify-content: center;
	}

	.note,
	.none {
		margin: 0.45rem 0 0;
		font-size: 0.62rem;
		color: var(--text-dim);
	}
</style>
