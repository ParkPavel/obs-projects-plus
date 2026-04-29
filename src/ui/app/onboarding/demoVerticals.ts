// src/ui/app/onboarding/demoVerticals.ts
//
// Data builders for the "industry verticals" (Fitness / Finance / CRM) that
// power the fitness-workout / finance-accounting / crm-clients widget
// templates. Writes realistic frontmatter records into a target folder.
//
// DATA FLOW OVER FOLDERS — callers now pass the demo root folder (not a
// subfolder) so that all vertical records land in the same flat data
// stream as generic demo entities. Per-view filters on frontmatter `type`
// (`workout` | `transaction` | `client`) isolate them. No physical
// subfolder split. See `demoProject.ts` for the integration point.

import dayjs from "dayjs";
import { normalizePath, stringifyYaml, type Vault } from "obsidian";

// ── helpers ──────────────────────────────────────────────────

export interface DemoFile {
  frontmatter: Record<string, unknown>;
  content: string;
}

/**
 * Idempotent: re-running the demo seed on an existing vault must not throw.
 * createFolder throws if the folder exists; vault.create throws if the file
 * exists. We swallow those specific "already exists" paths but let other
 * IO errors propagate so the caller can log them.
 */
export async function writeDemoFiles(
  vault: Vault,
  folder: string,
  files: Record<string, DemoFile>
): Promise<void> {
  try {
    await vault.createFolder(folder);
  } catch {
    // folder already exists
  }
  for (const [name, { frontmatter, content }] of Object.entries(files)) {
    const yaml = stringifyYaml(frontmatter);
    const full = `---\n${yaml}---\n${content}`;
    const path = normalizePath(`${folder}/${name}.md`);
    try {
      await vault.create(path, full);
    } catch {
      // file already exists — skip (demo is idempotent)
    }
  }
}

// ── FITNESS / GYM ────────────────────────────────────────────

export function buildFitnessFiles(): Record<string, DemoFile> {
  const today = dayjs();
  const mk = (
    dayOffset: number,
    exercise: string,
    sets: Array<{ reps: number; weight: number; restSec: number }>
  ): DemoFile => ({
    frontmatter: {
      type: "workout",
      date: today.subtract(dayOffset, "day").format("YYYY-MM-DD"),
      exercise,
      sets,
    },
    content: `## 💪 ${exercise}\n\nWorkout log for ${today.subtract(dayOffset, "day").format("YYYY-MM-DD")}.\n`,
  });
  return {
    "Bench Press — Week 1 Day 1": mk(14, "Bench Press", [
      { reps: 8, weight: 60, restSec: 120 },
      { reps: 8, weight: 65, restSec: 120 },
      { reps: 6, weight: 70, restSec: 150 },
    ]),
    "Squats — Week 1 Day 2": mk(13, "Squats", [
      { reps: 10, weight: 80, restSec: 120 },
      { reps: 8, weight: 90, restSec: 150 },
      { reps: 6, weight: 100, restSec: 180 },
    ]),
    "Deadlift — Week 1 Day 3": mk(12, "Deadlift", [
      { reps: 5, weight: 100, restSec: 180 },
      { reps: 5, weight: 110, restSec: 180 },
      { reps: 3, weight: 120, restSec: 240 },
    ]),
    "Bench Press — Week 2 Day 1": mk(7, "Bench Press", [
      { reps: 8, weight: 65, restSec: 120 },
      { reps: 8, weight: 70, restSec: 120 },
      { reps: 6, weight: 75, restSec: 150 },
    ]),
    "Squats — Week 2 Day 2": mk(6, "Squats", [
      { reps: 10, weight: 85, restSec: 120 },
      { reps: 8, weight: 95, restSec: 150 },
      { reps: 6, weight: 105, restSec: 180 },
    ]),
    "Deadlift — Week 2 Day 3": mk(5, "Deadlift", [
      { reps: 5, weight: 105, restSec: 180 },
      { reps: 5, weight: 115, restSec: 180 },
      { reps: 3, weight: 125, restSec: 240 },
    ]),
    "Bench Press — Week 3 Day 1": mk(0, "Bench Press", [
      { reps: 8, weight: 70, restSec: 120 },
      { reps: 8, weight: 75, restSec: 120 },
      { reps: 6, weight: 80, restSec: 150 },
    ]),
  };
}

// ── FINANCE / ACCOUNTING ─────────────────────────────────────

export function buildFinanceFiles(): Record<string, DemoFile> {
  const today = dayjs();
  const mk = (
    dayOffset: number,
    name: string,
    amount: number,
    taxRate: number,
    rate: number,
    creditLine: number
  ): DemoFile => {
    const tax = +(amount * taxRate).toFixed(2);
    const net = +(amount - tax).toFixed(2);
    return {
      frontmatter: {
        type: "transaction",
        date: today.subtract(dayOffset, "day").format("YYYY-MM-DD"),
        amount,
        tax,
        net,
        rate,
        creditLine,
        currency: "USD",
        category: name.split(" ")[0],
      },
      content: `## 💰 ${name}\n\nTransaction recorded on ${today.subtract(dayOffset, "day").format("YYYY-MM-DD")}.\n`,
    };
  };
  return {
    "Invoice — Client A (Jan)": mk(90, "Invoice Client-A", 12000, 0.2, 1.0, 0.1),
    "Invoice — Client B (Jan)": mk(85, "Invoice Client-B", 8500, 0.2, 0.92, 0.15),
    "Expense — Office Rent": mk(80, "Expense Rent", 3200, 0.0, 1.0, 0.2),
    "Invoice — Client A (Feb)": mk(60, "Invoice Client-A", 14500, 0.2, 0.95, 0.18),
    "Expense — Software": mk(55, "Expense Software", 1200, 0.2, 1.05, 0.22),
    "Invoice — Client C (Feb)": mk(50, "Invoice Client-C", 6700, 0.15, 1.1, 0.25),
    "Invoice — Client A (Mar)": mk(30, "Invoice Client-A", 16000, 0.2, 0.98, 0.28),
    "Expense — Marketing": mk(25, "Expense Marketing", 2400, 0.1, 1.0, 0.3),
    "Invoice — Client B (Mar)": mk(20, "Invoice Client-B", 9800, 0.2, 0.93, 0.32),
    "Invoice — Client A (Apr)": mk(5, "Invoice Client-A", 17500, 0.2, 0.96, 0.35),
  };
}

// ── CRM / CLIENTS ────────────────────────────────────────────

export function buildCrmFiles(): Record<string, DemoFile> {
  const today = dayjs();
  const mk = (
    name: string,
    stage: string,
    active: boolean,
    mrr: number,
    sessions: Array<{ date: string; duration: number; topic: string }>
  ): DemoFile => ({
    frontmatter: {
      type: "client",
      name,
      stage,
      active,
      mrr,
      sessionsCount: sessions.length,
      sessions,
      signupDate: today.subtract(60, "day").format("YYYY-MM-DD"),
    },
    content: `## 👤 ${name}\n\nStage: ${stage}\n`,
  });
  const s = (daysAgo: number, duration: number, topic: string) => ({
    date: today.subtract(daysAgo, "day").format("YYYY-MM-DD"),
    duration,
    topic,
  });
  return {
    "Acme Corp": mk("Acme Corp", "active", true, 4800, [
      s(45, 60, "Onboarding"),
      s(30, 45, "Review Q1"),
      s(15, 30, "Feature request"),
      s(2, 60, "Monthly sync"),
    ]),
    "Globex Industries": mk("Globex Industries", "active", true, 3200, [
      s(40, 45, "Kickoff"),
      s(20, 60, "Strategy session"),
      s(5, 30, "Follow-up"),
    ]),
    "Initech Solutions": mk("Initech Solutions", "negotiation", false, 0, [
      s(10, 60, "Demo"),
      s(3, 45, "Pricing discussion"),
    ]),
    "Stark Dynamics": mk("Stark Dynamics", "active", true, 7200, [
      s(50, 60, "Onboarding"),
      s(35, 45, "Review"),
      s(20, 60, "Feature walkthrough"),
      s(8, 30, "QBR"),
    ]),
    "Wayne Enterprises": mk("Wayne Enterprises", "prospect", false, 0, [
      s(7, 30, "Discovery call"),
    ]),
    "Umbrella Corp": mk("Umbrella Corp", "churned", false, 0, [
      s(120, 60, "Final review"),
    ]),
    "Cyberdyne Systems": mk("Cyberdyne Systems", "negotiation", false, 0, [
      s(14, 45, "Demo"),
      s(6, 30, "Proposal review"),
    ]),
    "Tyrell Corporation": mk("Tyrell Corporation", "prospect", false, 0, []),
  };
}
