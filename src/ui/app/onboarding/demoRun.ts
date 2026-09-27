// ============================================================
// Creating the demo from any entry point — the first-run window, the empty
// projects screen, the project menu and the command — with one behaviour:
// a progress notice while ~500 notes are written, one result notice, and the
// practice's overview opened when the demo is ready.
// ============================================================

import { Notice, type Vault } from "obsidian";
import { get } from "svelte/store";
import { i18n } from "src/lib/stores/i18n";
import { noticeFor } from "src/lib/errors/errorText";
import { createDemoProject, type DemoResult } from "./demoProject";

/** #202 — a repair that could not write every missing note. */
const DEMO_REPAIR_FAILED = "PPP-603";

/** The run in progress: a second click or command joins it instead of racing it. */
let inFlight: Promise<DemoResult | null> | null = null;

export function createDemoWithNotices(
  vault: Vault,
  open: (projectId: string, viewId: string) => void
): Promise<DemoResult | null> {
  if (!inFlight) {
    inFlight = runDemo(vault, open).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function runDemo(
  vault: Vault,
  open: (projectId: string, viewId: string) => void
): Promise<DemoResult | null> {
  const t = get(i18n).t;
  const progress = new Notice(t("onboarding.demo.busy", { defaultValue: "Creating the demo…" }), 0);
  try {
    const result = await createDemoProject(vault);
    progress.hide();
    // The generator has reported it (PPP-601); nothing exists to repair or open.
    if (result.aborted) return null;
    if (result.created.length > 0) {
      new Notice(t("commands.create-demo-project.created", { defaultValue: "Demo projects created." }), 5000);
    } else {
      new Notice(
        result.failed > 0
          ? noticeFor(DEMO_REPAIR_FAILED, { count: result.failed })
          : t("commands.create-demo-project.repaired", {
              defaultValue: "The demo already exists; any missing notes have been restored.",
            }),
        6000
      );
    }
    if (result.open) open(result.open.projectId, result.open.viewId);
    return result;
  } catch (error) {
    // A failure the generator did not report itself: say so rather than let
    // the promise fail unseen.
    progress.hide();
    console.error("[Projects+] the demo could not be created", error);
    new Notice(noticeFor(DEMO_REPAIR_FAILED, { count: 0 }), 6000);
    return null;
  }
}
