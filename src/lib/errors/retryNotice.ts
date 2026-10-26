// w4-p04 (audit F17) — a notice that offers to try a write again.
//
// A batch that did not reach every note says how many it missed; when some of
// them refused the write (not merely went missing), a retry has something to
// do, so the notice carries a "Retry" button. The retry is the caller's: it
// writes only what failed and reports its own outcome the same way.

import { Notice } from "obsidian";
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";

/** Long enough to read the count and reach the button on a phone. */
const RETRY_NOTICE_MS = 15000;

export function noticeWithRetry(text: string, retry: (() => void) | undefined): Notice {
  if (!retry) return new Notice(text);
  const fragment = createFragment();
  const button = createEl("button", {
    text: get(i18n).t("common.retry"),
    cls: "mod-cta ppp-retry-notice-button",
    attr: { type: "button" },
  });
  fragment.append(createDiv({ text }), button);
  const notice = new Notice(fragment, RETRY_NOTICE_MS);
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    notice.hide();
    retry();
  });
  return notice;
}
