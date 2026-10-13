<script lang="ts">
	import type { FleetShip } from '$lib/engine/types';
	import type { Heading } from '$lib/engine/movement';
	import { hullCode } from '$lib/engine/fleet';
	import { i18n } from '$lib/i18n/index.svelte';
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

<Panel title={i18n.t.helm.title} tone="ally">
	{#if ships.length === 0}
		<p class="none">{i18n.t.helm.none}</p>
	{:else}
		<ul>
			{#each ships as ship, index (ship.class)}
				<li>
					<button
						type="button"
						class:on={selected === index}
						onclick={() => onSelect(index)}
					>
						<span class="code">{hullCode(ship.class)}</span>
						<span class="name">{i18n.t.ships[ship.class]}</span>
						<span class="fuel" aria-label={i18n.t.helm.fuelAria(ship.fuel)}>
							{i18n.t.helm.fuel(ship.fuel)}
						</span>
					</button>
				</li>
			{/each}
		</ul>

		<div class="steer">
			<button type="button" disabled={!canSteer('astern')} onclick={() => onSteer('astern')}>
				{i18n.t.helm.astern}
			</button>
			<button type="button" disabled={!canSteer('ahead')} onclick={() => onSteer('ahead')}>
				{i18n.t.helm.ahead}
			</button>
		</div>
		<p class="note">{i18n.t.helm.note}</p>
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

	.fuel {
		margin-left: auto;
		color: var(--text-dim);
		font-size: 0.62rem;
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
