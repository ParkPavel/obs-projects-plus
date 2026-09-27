// esbuild replaces `process.env.NODE_ENV` with "production" when it minifies
// the release bundle, so this reads no Node global in Obsidian (mobile has
// none); under Jest it is Node's own.
/* global process -- esbuild's define, see above */

/** True in the release bundle. */
export const isProduction = process.env["NODE_ENV"] === "production";
