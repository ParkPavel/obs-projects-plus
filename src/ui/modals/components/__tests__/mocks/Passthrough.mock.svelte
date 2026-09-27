<!-- Stand-in for ModalLayout/ModalContent/SettingItem — src/__mocks__/obsidian-svelte.js
     renders none of its exports' slots, so a field mounted inside one would
     never reach the DOM. This renders its slot and nothing else. -->
<script>
</script>

<div><slot /></div>
