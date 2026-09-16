import { App, Modal } from "obsidian";

import Onboarding from "./Onboarding.svelte";
import type { StarterProfileId } from "./starterProfiles";

export class OnboardingModal extends Modal {
  component?: Onboarding;

  constructor(
    readonly app: App,
    readonly onCreate: () => void,
    readonly onTry: () => void,
    /**
     * Scene 7 — the primary path. The modal closes only once this
     * resolves; a rejection (e.g. `StarterProfileWriteError`) is left for
     * `Onboarding.svelte` to show inline and keeps the modal open.
     */
    readonly onProfile: (profileId: StarterProfileId) => Promise<void>
  ) {
    super(app);
  }

  onOpen() {
    this.component = new Onboarding({
      target: this.contentEl,
      props: {
        onCreate: () => {
          this.onCreate();
          this.close();
        },
        onTry: () => {
          this.onTry();
          this.close();
        },
        onProfile: async (profileId: StarterProfileId) => {
          await this.onProfile(profileId);
          this.close();
        },
      },
    });
  }
}
