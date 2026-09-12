<script>
	// #191: this mock existed to fire `applyTemplate`, the toolbar's other
	// event, which is gone with the template mechanism. It stays as a stub
	// because `DashboardCanvas.test.ts` still mocks the real component — that
	// one pulls in FloatingPopup and the widget registry, neither of which a
	// canvas layout test has any reason to mount.
	import { createEventDispatcher } from "svelte";

	const dispatch = createEventDispatcher();
</script>

<button class="widget-toolbar-mock-add" on:click={() => dispatch("addWidget", "chart")}>
	Add Mock Widget
</button>
