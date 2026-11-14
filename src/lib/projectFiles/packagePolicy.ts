export const PACKAGE_LIMITS = {
  files: 256, fileBytes: 4 * 1024 * 1024, totalBytes: 16 * 1024 * 1024, archiveBytes: 20 * 1024 * 1024,
  manifestBytes: 512 * 1024, projects: 100, dependencies: 4096,
} as const;

export type PackageInspectionCode = "invalid-zip" | "unsupported-zip" | "unsafe-path" | "size-limit" | "invalid-manifest" | "checksum";
export class PackageInspectionError extends Error {
  constructor(readonly code: PackageInspectionCode) { super(`Project package: ${code}`); this.name = "PackageInspectionError"; }
}
