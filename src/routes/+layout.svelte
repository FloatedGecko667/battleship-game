<script lang="ts">
	import '@fontsource-variable/jetbrains-mono';
	import '$lib/ui/tokens.css';
	import { onMount } from 'svelte';

	let { children } = $props();

	// The plugin emits the worker but does not register it under SvelteKit, so
	// without this the app never caches itself however healthy the build looks.
	// The manifest link is static, in app.html.
	onMount(async () => {
		const { registerSW } = await import('virtual:pwa-register');
		registerSW({ immediate: true });
	});
</script>

{@render children()}
