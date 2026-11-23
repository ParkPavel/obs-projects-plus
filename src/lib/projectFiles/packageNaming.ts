import { projectFileError } from "./document";
import { projectFilesRoot } from "./paths";

/** Display names stay untouched; only the portable filename gets sanitised. */
export function packageArchivePath(folder: string, projectName: string, createdAt: string, ordinal: number, configDir: string): string {
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 1000 || !/^\d{4}-\d{2}-\d{2}T/.test(createdAt) ||
      !Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString() !== createdAt) throw projectFileError("invalid archive name request");
  projectFilesRoot(folder, configDir);
  const suffix = ` — ${createdAt.slice(0, 10)}${ordinal > 1 ? ` (${ordinal})` : ""}.zip`;
  const limit = Math.min(64, 240 - folder.length - 1 - suffix.length);
  if (limit < 1) throw projectFileError("archive destination too long");
  let clean = projectName.normalize("NFC").replace(/[<>:"/\\|?*%\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/gu, " ").replace(/^[. ]+|[. ]+$/g, "") || "Project";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean)) clean = "Project " + clean;
  let stem = "";
  for (const point of clean) { if (stem.length + point.length > limit) break; stem += point; }
  stem = stem.replace(/[. ]+$/g, "") || "P";
  return projectFilesRoot(`${folder}/${stem}${suffix}`, configDir);
}
