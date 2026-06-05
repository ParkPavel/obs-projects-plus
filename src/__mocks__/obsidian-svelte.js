// Manual mock for obsidian-svelte — stubs all exports so Jest does not
// need to parse/transform the ESM+Svelte package at test time.

// Svelte 3 compiles `<SomeComponent ...>` to calls like:
//   new SomeComponent({ target, anchor, props })
//   create_component(component.$$.fragment)  — checks block && block.c()
//   mount_component(component, target, anchor) — checks $$.fragment && fragment.m()
//   destroy_component(component, detaching)  — checks $$.fragment !== null
//
// Setting $$.fragment = null satisfies all three checks (each guards on null).
// We don't need to insert DOM nodes because Svelte's helpers handle anchoring.

function noopComponent() {
  this.$$ = {
    fragment: null,
    after_update: [],
    on_mount: [],
    on_destroy: [],
    ctx: [],
  };
}
noopComponent.prototype.$set = function() {};
noopComponent.prototype.$on = function() { return () => {}; };
noopComponent.prototype.$destroy = function() {};

module.exports = {
  Autocomplete: noopComponent,
  FileAutocomplete: noopComponent,
  Button: noopComponent,
  Callout: noopComponent,
  Card: noopComponent,
  Checkbox: noopComponent,
  ColorInput: noopComponent,
  DateInput: noopComponent,
  Icon: noopComponent,
  IconButton: noopComponent,
  useIcon: jest.fn(() => ({ update: jest.fn() })),
  InternalLink: noopComponent,
  Link: noopComponent,
  Loading: noopComponent,
  ModalLayout: noopComponent,
  ModalButtonGroup: noopComponent,
  ModalContent: noopComponent,
  Popover: noopComponent,
  Menu: noopComponent,
  MenuItem: noopComponent,
  Suggestion: noopComponent,
  SuggestionItem: noopComponent,
  Select: noopComponent,
  SettingItem: noopComponent,
  Slider: noopComponent,
  Switch: noopComponent,
  Tag: noopComponent,
  TextArea: noopComponent,
  TextInput: noopComponent,
  NumberInput: noopComponent,
  Typography: noopComponent,
};

module.exports = {
  Autocomplete: noopComponent,
  FileAutocomplete: noopComponent,
  Button: noopComponent,
  Callout: noopComponent,
  Card: noopComponent,
  Checkbox: noopComponent,
  ColorInput: noopComponent,
  DateInput: noopComponent,
  Icon: noopComponent,
  IconButton: noopComponent,
  useIcon: jest.fn(() => ({ update: jest.fn() })),
  InternalLink: noopComponent,
  Link: noopComponent,
  Loading: noopComponent,
  ModalLayout: noopComponent,
  ModalButtonGroup: noopComponent,
  ModalContent: noopComponent,
  Popover: noopComponent,
  Menu: noopComponent,
  MenuItem: noopComponent,
  Suggestion: noopComponent,
  SuggestionItem: noopComponent,
  Select: noopComponent,
  SettingItem: noopComponent,
  Slider: noopComponent,
  Switch: noopComponent,
  Tag: noopComponent,
  TextArea: noopComponent,
  TextInput: noopComponent,
  NumberInput: noopComponent,
  Typography: noopComponent,
};
