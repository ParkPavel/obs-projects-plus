import { Zip, ZipPassThrough, unzipSync } from "fflate";
import { projectFileError } from "./document";
import { binaryDigest, PACKAGE_LIMITS, type PreparedProjectPackage } from "./package";

/** Stored ZIP keeps per-file work bounded and avoids worker/CSP assumptions on mobile. */
export async function createProjectZip(prepared: PreparedProjectPackage, check: () => void = () => {}): Promise<Uint8Array> {
  const expected = new Map(prepared.manifest.files.map(file => [file.path, file]));
  if (expected.size !== prepared.manifest.files.length || prepared.entries.size !== expected.size + 1 || expected.size >= PACKAGE_LIMITS.files) throw projectFileError("invalid package entries");
  let inputBytes = 0;
  for (const [path, bytes] of prepared.entries) {
    check();
    inputBytes += bytes.length;
    if (inputBytes > PACKAGE_LIMITS.totalBytes || bytes.length > PACKAGE_LIMITS.fileBytes) throw projectFileError("package size limit");
    const description = expected.get(path);
    const hash = await binaryDigest(bytes);
    if (path === "manifest.json" ? hash !== await binaryDigest(new TextEncoder().encode(JSON.stringify(prepared.manifest, null, 2) + "\n"))
      : !description || description.bytes !== bytes.length || description.sha256 !== hash) throw projectFileError("package preview changed");
  }
  const chunks: Uint8Array[] = [];
  let size = 0, finished = false;
  const zip = new Zip((error, chunk, final) => {
    if (error) throw error;
    size += chunk.length;
    if (size > PACKAGE_LIMITS.archiveBytes) throw projectFileError("archive size limit");
    chunks.push(chunk); finished = final;
  });
  try {
    for (const [path, bytes] of prepared.entries) {
      check();
      const file = new ZipPassThrough(path);
      file.mtime = new Date(2020, 0, 1); // Stable bytes for the reviewed captured manifest.
      zip.add(file);
      for (let at = 0; at < bytes.length; at += 65536) { check(); file.push(bytes.subarray(at, at + 65536), false); }
      file.push(new Uint8Array(), true);
      await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    }
    check(); zip.end();
    if (!finished) throw projectFileError("incomplete ZIP creation");
    const result = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) { result.set(chunk, at); at += chunk.length; }
    // ONLY our just-generated stored ZIP, never an untrusted import. Import needs
    // a separate bounded streaming decoder and validation/staging contract.
    const seen = new Set<string>();
    const unpacked = unzipSync(result, { filter(file) {
      const expected = prepared.entries.get(file.name);
      if (!expected || seen.has(file.name) || file.compression !== 0 || file.size !== expected.length || file.originalSize !== expected.length) throw projectFileError("generated ZIP entry mismatch");
      seen.add(file.name); return true;
    } });
    if (seen.size !== prepared.entries.size) throw projectFileError("generated ZIP entries missing");
    for (const [path, bytes] of prepared.entries) {
      check();
      if (!unpacked[path] || await binaryDigest(unpacked[path]) !== await binaryDigest(bytes)) throw projectFileError("generated ZIP checksum mismatch");
    }
    return result;
  } finally { zip.terminate(); }
}
