<script lang="ts">
  /**
   * SmartSuggestionBus — #059 SmartSuggest strip (Vision §6, M-VISION-PARITY).
   *
   * Canvas singleton: watches the frame schema and offers the next analytical
   * step ("numeric field → Stats block"). Renders one suggestion at a time —
   * the strip is a hint, not a queue. × hides the suggestion for this session;
   * "Don't suggest again" asks the canvas to persist the kind into
   * `DatabaseViewConfig.dismissedSuggestions`. Not rendered on an empty canvas
   * — the #065 zero-state owns that moment.
   */
  import { createEventDispatcher } from "svelte";
  import { Icon } from "obsidian-svelte";
  import type { DataField } from "src/lib/dataframe/dataframe";
  import { i18n } from "src/lib/stores/i18n";
  import type { WidgetDefinition } from "./types";
  import {
    computeSuggestions,
    type SmartSuggestion,
    type SuggestionKind,
  } from "./smartSuggest";

  export let fields: readonly DataField[];
  export let widgets: readonly WidgetDefinition[];
  export let dismissed: readonly string[] = [];

  const dispatch = createEventDispatcher<{
    accept: SmartSuggestion;
    dismissForever: SuggestionKind;
  }>();

  let sessionDismissed: SuggestionKind[] = [];

  $: suggestions = computeSuggestions(fields, widgets, [
    ...dismissed,
    ...sessionDismissed,
  ]);
  $: current = suggestions[0];

  interface StripText {
    messageKey: string;
    messageDefault: string;
    messageParams: Record<string, string>;
    actionKey: string;
    actionDefault: string;
  }

  // date-chart's message names whichever field it will actually plot on Y
  // (the numeric field it found, or nothing when it will count records
  // instead) — that is the one variable part; the other two kinds are static
  // per-kind text keyed only by the triggering field.
  function stripText(s: SmartSuggestion): StripText {
    switch (s.kind) {
      case "numeric-stats":
        return {
          messageKey: "views.dashboard.smart-suggest.numeric-message",
          messageDefault:
            'Numeric field "{{field}}" detected — want a Stats block with sum and average?',
          messageParams: { field: s.fieldName },
          actionKey: "views.dashboard.smart-suggest.numeric-action",
          actionDefault: "Add Stats",
        };
      case "relation-block":
        return {
          messageKey: "views.dashboard.smart-suggest.relation-message",
          messageDefault:
            'Relation field "{{field}}" detected — show related records in a linked data block?',
          messageParams: { field: s.fieldName },
          actionKey: "views.dashboard.smart-suggest.relation-action",
          actionDefault: "Add data block",
        };
      case "date-chart":
        return s.numericFieldName
          ? {
              messageKey: "views.dashboard.smart-suggest.date-avg-message",
              messageDefault:
                'Date field "{{field}}" detected — build a chart of "{{numericField}}" averaged by date?',
              messageParams: { field: s.fieldName, numericField: s.numericFieldName },
              actionKey: "views.dashboard.smart-suggest.date-action",
              actionDefault: "Build dynamics",
            }
          : {
              messageKey: "views.dashboard.smart-suggest.date-count-message",
              messageDefault:
                'Date field "{{field}}" detected — build a chart of record count by date?',
              messageParams: { field: s.fieldName },
              actionKey: "views.dashboard.smart-suggest.date-action",
              actionDefault: "Build dynamics",
            };
    }
  }
</script>

{#if current}
  {@const s = current}
  {@const text = stripText(s)}
  <div class="ppp-smart-suggest" role="status">
    <span class="ppp-smart-suggest__icon"><Icon name="lightbulb" /></span>
    <span class="ppp-smart-suggest__message">
      {$i18n.t(text.messageKey, {
        defaultValue: text.messageDefault,
        ...text.messageParams,
      })}
    </span>
    <button class="ppp-smart-suggest__accept" on:click={() => dispatch("accept", s)}>
      {$i18n.t(text.actionKey, {
        defaultValue: text.actionDefault,
      })}
    </button>
    <button
      class="ppp-smart-suggest__never"
      on:click={() => dispatch("dismissForever", s.kind)}
    >
      {$i18n.t("views.dashboard.smart-suggest.never", {
        defaultValue: "Don't suggest again",
      })}
    </button>
    <button
      class="ppp-smart-suggest__close clickable-icon"
      aria-label={$i18n.t("views.dashboard.smart-suggest.close", {
        defaultValue: "Hide suggestion",
      })}
      on:click={() => (sessionDismissed = [...sessionDismissed, s.kind])}
    >
      <Icon name="x" />
    </button>
  </div>
{/if}

<style>
  .ppp-smart-suggest {
    display: flex;
    align-items: center;
    gap: var(--ppp-space-2, 0.25rem);
    padding: var(--ppp-space-2, 0.25rem) var(--ppp-space-3, 0.375rem);
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    background: var(--background-secondary);
    border: 0.0625rem solid var(--background-modifier-border);
    border-left: 0.1875rem solid var(--interactive-accent);
    border-radius: var(--radius-s, 0.25rem);
  }

  .ppp-smart-suggest__icon {
    flex-shrink: 0;
    display: inline-flex;
    color: var(--interactive-accent);
  }

  .ppp-smart-suggest__message {
    flex: 1;
    min-width: 0;
  }

  .ppp-smart-suggest__accept {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    font-size: var(--font-ui-small);
    color: var(--interactive-accent);
    background: transparent;
    border: 0.0625rem solid var(--interactive-accent);
    border-radius: var(--radius-s, 0.25rem);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .ppp-smart-suggest__accept:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .ppp-smart-suggest__accept:focus-visible,
  .ppp-smart-suggest__never:focus-visible,
  .ppp-smart-suggest__close:focus-visible {
    outline: 0.125rem solid var(--interactive-accent);
    outline-offset: 0.0625rem;
  }

  .ppp-smart-suggest__never {
    flex-shrink: 0;
    padding: 0.25rem 0.375rem;
    font-size: var(--ppp-font-size-sm, 0.75rem);
    color: var(--text-faint);
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .ppp-smart-suggest__never:hover {
    color: var(--text-muted);
    text-decoration: underline;
  }

  .ppp-smart-suggest__close {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.125rem;
    color: var(--text-faint);
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .ppp-smart-suggest__close:hover {
    color: var(--text-muted);
  }
</style>
