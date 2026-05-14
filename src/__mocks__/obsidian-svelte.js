// Manual mock for obsidian-svelte — stubs all exports so Jest does not
// need to parse/transform the ESM+Svelte package at test time.

const noopComponent = { render: () => ({ html: "", css: { code: "", map: null }, head: "" }) };

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
