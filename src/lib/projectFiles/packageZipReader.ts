import { checkedPackageEntryPath, packageNameKey } from "./packageManifest";
import { PACKAGE_LIMITS, PackageInspectionError } from "./packagePolicy";

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes: Uint8Array, check: () => void): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    if ((i & 65535) === 0) check();
    crc = crcTable[(crc ^ bytes[i]!) & 255]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Strict stored-ZIP profile. No inflate, host paths, file writes or executable payloads. */
export async function readStoredProjectZip(input: Uint8Array, configDir: string, check: () => void): Promise<{ entries: ReadonlyMap<string, Uint8Array>; archive: Uint8Array }> {
  const fail = (): never => { throw new PackageInspectionError("invalid-zip"); };
  const unsupported = (): never => { throw new PackageInspectionError("unsupported-zip"); };
  check();
  if (input.length > PACKAGE_LIMITS.archiveBytes) throw new PackageInspectionError("size-limit");
  if (input.length < 22) fail();
  // One bounded private capture; later changes to the caller's buffer cannot
  // alter a partially inspected archive between asynchronous checks.
  const bytes = new Uint8Array(input), view = new DataView(bytes.buffer);
  const range = (at: number, size: number, end = bytes.length) => {
    if (!Number.isSafeInteger(at) || at < 0 || size < 0 || at + size > end) fail();
  };
  const u16 = (at: number) => { range(at, 2); return view.getUint16(at, true); };
  const u32 = (at: number) => { range(at, 4); return view.getUint32(at, true); };
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65557); at--) {
    if (u32(at) === 0x06054b50 && at + 22 + u16(at + 20) === bytes.length) { end = at; break; }
  }
  if (end < 0) fail();
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== u16(end + 10)) unsupported();
  const count = u16(end + 10), centralSize = u32(end + 12), centralStart = u32(end + 16);
  if (!count || count > PACKAGE_LIMITS.files) throw new PackageInspectionError("size-limit");
  if (centralStart + centralSize !== end) fail();
  const entries: { path: string; start: number; data: number; length: number; finish: number; crc: number }[] = [];
  const names = new Set<string>();
  let at = centralStart, total = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  for (let i = 0; i < count; i++) {
    check(); range(at, 46, end);
    if (u32(at) !== 0x02014b50) fail();
    const version = u16(at + 6), flags = u16(at + 8), method = u16(at + 10);
    const crc = u32(at + 16), packed = u32(at + 20), length = u32(at + 24);
    const nameSize = u16(at + 28), extraSize = u16(at + 30), commentSize = u16(at + 32), start = u32(at + 42);
    const attributes = u32(at + 38), unixType = (attributes >>> 16) & 0xf000;
    if (version < 10 || version > 20 || method !== 0 || (flags & ~0x0808) || u16(at + 34) || extraSize ||
        (attributes & 0x0418) || (unixType && unixType !== 0x8000)) unsupported();
    if (packed !== length) fail();
    total += length;
    if (length > PACKAGE_LIMITS.fileBytes || total > PACKAGE_LIMITS.totalBytes) throw new PackageInspectionError("size-limit");
    range(at, 46 + nameSize + extraSize + commentSize, end);
    const nameBytes = bytes.subarray(at + 46, at + 46 + nameSize);
    if (!(flags & 0x0800) && nameBytes.some(byte => byte >= 128)) unsupported();
    let path: string;
    try { path = decoder.decode(nameBytes); } catch { fail(); }
    checkedPackageEntryPath(path!, configDir);
    const key = packageNameKey(path!);
    if (names.has(key)) throw new PackageInspectionError("unsafe-path");
    names.add(key);
    range(start, 30, centralStart);
    if (u32(start) !== 0x04034b50 || u16(start + 4) !== version || u16(start + 6) !== flags || u16(start + 8) !== method ||
        u32(start + 10) !== u32(at + 12) || u16(start + 26) !== nameSize || u16(start + 28)) fail();
    range(start + 30, nameSize, centralStart);
    for (let j = 0; j < nameSize; j++) if (bytes[start + 30 + j] !== nameBytes[j]) fail();
    const data = start + 30 + nameSize;
    range(data, length, centralStart);
    let finish = data + length;
    if (flags & 8) {
      if (u32(start + 14) || u32(start + 18) || u32(start + 22)) fail();
      range(finish, 16, centralStart);
      // The producer emits signed descriptors. Other profiles are explicit
      // unsupported input, never guessed from potentially ambiguous CRC bytes.
      if (u32(finish) !== 0x08074b50) unsupported();
      if (u32(finish + 4) !== crc || u32(finish + 8) !== length || u32(finish + 12) !== length) fail();
      finish += 16;
    } else if (u32(start + 14) !== crc || u32(start + 18) !== length || u32(start + 22) !== length) fail();
    entries.push({ path: path!, start, data, length, finish, crc });
    at += 46 + nameSize + extraSize + commentSize;
  }
  if (at !== end) fail();
  // Reject hidden local entries, overlapping ranges, prepended stubs and gaps.
  entries.sort((left, right) => left.start - right.start);
  let next = 0;
  for (const entry of entries) { if (entry.start !== next) fail(); next = entry.finish; }
  if (next !== centralStart) fail();
  for (const name of names) {
    const parts = name.split("/");
    for (let i = 1; i < parts.length; i++) if (names.has(parts.slice(0, i).join("/"))) throw new PackageInspectionError("unsafe-path");
  }
  const result = new Map<string, Uint8Array>();
  for (const entry of entries) {
    check();
    const content = bytes.subarray(entry.data, entry.data + entry.length);
    if (crc32(content, check) !== entry.crc) throw new PackageInspectionError("checksum");
    result.set(entry.path, content);
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
  }
  check(); return { entries: result, archive: bytes };
}
