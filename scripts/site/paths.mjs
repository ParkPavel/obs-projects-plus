import fs from 'node:fs/promises';
import path from 'node:path';

const hasControls = value => [...value].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127);

const isRepoPath = value => typeof value === 'string' && value !== ''
  && !/[\\:]/.test(value) && !hasControls(value) && !path.posix.isAbsolute(value) && !path.win32.isAbsolute(value)
  && value !== '..' && !value.startsWith('../') && path.posix.normalize(value) === value;

export function safeHref(href) {
  return typeof href === 'string' && [...href].every(c => c.charCodeAt(0) > 32 && c.charCodeAt(0) !== 127)
    && (!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href) || /^(?:https?:|mailto:)/i.test(href));
}

/** Resolve Markdown's POSIX paths without interpreting Windows separators. */
export function resolveRepoReference(source, href) {
  if (!isRepoPath(source) || !safeHref(href) || /^(?:https?:|mailto:|#)/i.test(href)) return null;
  const at = href.indexOf('#');
  const filename = at < 0 ? href : href.slice(0, at);
  const hash = at < 0 ? '' : href.slice(at + 1);
  let decoded;
  try { decoded = decodeURIComponent(filename); } catch { return null; }
  // Colon also rejects drive-relative paths and Windows alternate streams.
  if (!decoded || /[\\:]/.test(decoded) || hasControls(decoded) || path.posix.isAbsolute(decoded) || path.win32.isAbsolute(decoded)) return null;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(source), decoded));
  if (resolved === '..' || resolved.startsWith('../') || path.posix.isAbsolute(resolved)) return null;
  return { source: resolved, hash };
}

/** Keep the docs index route and give the root README its own document page. */
export function documentationRoutes(sources) {
  const routes = new Map(), owners = new Map();
  for (const source of sources) {
    if (!isRepoPath(source)) throw new Error(`Unsafe documentation source: ${source}`);
    const name = source === 'README.md' ? 'project-readme.md' : source.startsWith('docs/') ? source.slice(5) : source;
    const url = `read/${name.replace(/\.md$/i,'').toLowerCase().replaceAll('/','-')}.html`;
    if (owners.has(url)) throw new Error(`Documentation route collision: ${owners.get(url)} and ${source} -> ${url}`);
    owners.set(url,source); routes.set(source,url);
  }
  return routes;
}

function within(root, target) {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

const publicMediaPath = relative => isRepoPath(relative)
  && relative.split('/').every(part=>!part.startsWith('.'))
  && /^(?:images\/|docs\/(?:assets|media)\/)/.test(relative)
  && /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i.test(relative);

/** Check both lexical and actual containment before reading any source bytes. */
async function readAllowedFile(root, relative, permitted, area = 'public documentation media areas') {
  if (!isRepoPath(relative)) throw new Error(`Unsafe repository file: ${relative}`);
  if (!permitted(relative)) throw new Error(`File is outside ${area}: ${relative}`);
  const realRoot = await fs.realpath(root);
  const candidate = path.resolve(realRoot, ...relative.split('/'));
  if (!within(realRoot, candidate)) throw new Error(`Repository path escapes root: ${relative}`);
  const realFile = await fs.realpath(candidate);
  if (!within(realRoot, realFile)) throw new Error(`Repository symlink escapes root: ${relative}`);
  if (!permitted(path.relative(realRoot,realFile).split(path.sep).join('/'))) throw new Error(`Symlink target is outside ${area}: ${relative}`);
  const stat = await fs.stat(realFile);
  if (!stat.isFile()) throw new Error(`Repository source is not a file: ${relative}`);
  return fs.readFile(realFile);
}

export function readRepoFile(root, relative) { return readAllowedFile(root,relative,()=>true); }
export function readPublicMedia(root, relative) { return readAllowedFile(root,relative,publicMediaPath); }
export function readDocumentationSource(root, relative, sources) {
  return readAllowedFile(root,relative,target=>sources.has(target)&&target.split('/').every(part=>!part.startsWith('.')),'declared public documentation sources');
}

/** Generated output may not follow an existing directory/file link outside. */
export async function writeRepoFile(root, relative, content) {
  if (!isRepoPath(relative)) throw new Error(`Unsafe repository file: ${relative}`);
  const realRoot = await fs.realpath(root);
  const target = path.resolve(realRoot, ...relative.split('/'));
  let parent = path.dirname(target);
  // Validate the nearest existing ancestor BEFORE recursive mkdir follows it.
  while (true) {
    if (!within(realRoot, parent)) throw new Error(`Repository output escapes root: ${relative}`);
    try {
      const realParent = await fs.realpath(parent);
      if (!within(realRoot, realParent)) throw new Error(`Repository output symlink escapes root: ${relative}`);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      parent = path.dirname(parent);
    }
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  const entry = await fs.lstat(target).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (entry) {
    // A dangling final link must fail here, rather than create its outside target.
    const realTarget = await fs.realpath(target);
    if (!within(realRoot, realTarget)) throw new Error(`Repository output symlink escapes root: ${relative}`);
  }
  await fs.writeFile(target, content);
}
