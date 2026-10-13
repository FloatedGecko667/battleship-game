<script lang="ts">
	import Panel from './Panel.svelte';
	import { i18n } from '$lib/i18n/index.svelte';

	const t = $derived(i18n.t.legend);
</script>

<Panel title={t.title}>
	<ul>
		<li><span class="pin miss">●</span> {t.miss}</li>
		<li>
			<span class="stack"><span class="pin hit">●</span><span class="cross">╳</span></span> {t.hit}
		</li>
		<li><span class="pin scan">●</span> {t.scan}</li>
		<li><span class="hull ally">▓</span> {t.ownHull}</li>
		<li><span class="hull enemy">▓</span> {t.enemyHull}</li>
		<li><span class="plane">◆</span> {t.aircraft}</li>
	</ul>
</Panel>

<style>
	ul {
		display: grid;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.72rem;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.stack {
		display: grid;
		place-items: center;
		width: 1rem;
	}

	.stack > * {
		grid-area: 1 / 1;
	}

	.pin,
	.hull,
	.cross {
		display: inline-grid;
		place-items: center;
		width: 1rem;
		line-height: 1;
	}

	.pin.miss {
		color: var(--rule);
	}

	.pin.scan {
		color: var(--ally);
		font-size: 0.6rem;
	}

	.pin.hit,
	.cross {
		color: var(--enemy);
	}

	.hull.ally {
		color: var(--ally);
	}

	.hull.enemy {
		color: var(--enemy);
	}

	.plane {
		display: inline-grid;
		place-items: center;
		width: 1rem;
		font-size: 0.65rem;
		color: var(--code);
	}
</style>
