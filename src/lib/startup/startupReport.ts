// w4-p12 (audit F13) — where a start-up's time goes, plugin and host apart.
//
// A slow start on the phone was argued about from impressions. Before any
// start-up work is moved or cut, it is measured: each stage is marked once,
// against the page's own clock (`performance.now()`, zero when Obsidian's
// window started), so the time Obsidian spent before loading the plugin and
// the time each stage of the plugin took read apart. The command "Start-up
// report" copies the text — a phone has no console to read it from.

export interface StartupStage {
  readonly name: string;
  /** Milliseconds since the window's time origin. */
  readonly at: number;
}

export interface StartupReport {
  /** Marks a stage; a stage already marked keeps its first time. */
  mark(name: string): void;
  stages(): readonly StartupStage[];
  /** The report as text, one stage per line. */
  text(): string;
}

const ms = (value: number) => `${Math.round(value)} ms`;

export function createStartupReport(now: () => number = () => performance.now()): StartupReport {
  const marked: StartupStage[] = [];
  return {
    mark(name) {
      if (marked.some((stage) => stage.name === name)) return;
      marked.push({ name, at: now() });
    },
    stages: () => marked,
    text() {
      const first = marked[0];
      if (!first) return "Projects Plus start-up: nothing measured yet";
      const lines = [`Projects Plus start-up`, `before the plugin (Obsidian): ${ms(first.at)}`];
      for (let i = 1; i < marked.length; i++) {
        const stage = marked[i]!;
        lines.push(`${stage.name}: ${ms(stage.at - marked[i - 1]!.at)}, at ${ms(stage.at)}`);
      }
      const last = marked[marked.length - 1]!;
      lines.push(`plugin, first to last stage: ${ms(last.at - first.at)}`);
      return lines.join("\n");
    },
  };
}

/** The plugin's one report: marked by the plugin and its first view. */
export const startupReport = createStartupReport();
