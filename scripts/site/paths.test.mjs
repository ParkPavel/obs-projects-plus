import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { safeHref, resolveRepoReference, readRepoFile, readPublicMedia, readDocumentationSource, writeRepoFile, documentationRoutes } from './paths.mjs';

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'ppp-site-paths-'));
const repo = path.join(fixture, 'repo');
const outside = path.join(fixture, 'outside');
await fs.mkdir(path.join(repo, 'media'), { recursive: true });
await fs.mkdir(path.join(repo, 'docs'), { recursive: true });
await fs.mkdir(outside);
await fs.writeFile(path.join(repo, 'README.md'), '# Read me');
await fs.writeFile(path.join(repo, 'media', 'cover #100%.png'), Buffer.from([137,80,78,71,13,10,26,10]));
await fs.writeFile(path.join(outside, 'secret.md'), 'outside fixture: never publish');
const link = path.join(repo, 'media', 'outside');
await fs.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
const links = [link];
after(async () => {
  for(const target of links)await fs.unlink(target);
  const resolved = path.resolve(fixture);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('ppp-site-paths-'));
  await fs.rm(resolved, { recursive: true, force: true });
});

test('local relative links retain anchors and encoded filenames within the repository', () => {
  assert.deepEqual(resolveRepoReference('docs/guide.md', '../README.md#install'), { source: 'README.md', hash: 'install' });
  assert.deepEqual(resolveRepoReference('docs/guide.md', '../media/cover%20%23100%25.png'), { source: 'media/cover #100%.png', hash: '' });
});

test('the project README and documentation index never shadow one another', () => {
  const routes = documentationRoutes(['README.md','README-RU.md','docs/README.md','docs/user-guide.md']);
  assert.equal(routes.get('README.md'),'read/project-readme.html');
  assert.equal(routes.get('docs/README.md'),'read/readme.html');
  assert.equal(routes.get('README-RU.md'),'read/readme-ru.html');
  assert.equal(new Set(routes.values()).size,4);
  assert.throws(()=>documentationRoutes(['docs/a-b.md','docs/a/b.md']),/route collision/);
});

test('native absolute, drive-relative, UNC and encoded backslashes are refused on every OS', () => {
  for (const href of ['C:/secret.png', 'C:secret.png', 'C:\\secret.png', '//host/share/file.png', '\\\\host\\share\\file.png', '/etc/passwd', '..\\..\\secret.png', '..%5c..%5csecret.png', '%5c%5chost%5cshare.png', '%43%3a/secret.png', 'media/file.png:stream']) {
    assert.equal(resolveRepoReference('docs/guide.md', href), null, href);
  }
});

test('plain and encoded traversal, malformed URI, unsafe schemes and controls are refused', () => {
  for (const href of ['../../secret.png', '%2e%2e/%2e%2e/secret.png', '../%2e%2e/secret.png', 'bad%2', 'bad%E0%A4%A.png', 'javascript:alert(1)', 'data:image/png;base64,abcd', 'javascript%3aalert(1)', 'media/%00secret.png', 'media/a\n.png', 'media/a\x7f.png']) {
    assert.equal(resolveRepoReference('docs/guide.md', href), null, href);
  }
  assert.equal(resolveRepoReference('C:\\docs\\guide.md', 'image.png'), null);
});

test('external HTTPS/mail and document anchors remain safe, unsafe protocols do not', () => {
  for (const href of ['https://example.test/image.png', 'HTTPS://example.test/image.png', 'mailto:hello@example.test', 'MAILTO:hello@example.test', '#install']) assert.equal(safeHref(href), true);
  for (const href of ['javascript:alert(1)', 'data:text/html,x', '//example.test/file', 'https://example.test/a\n']) assert.equal(safeHref(href), false);
});

test('ordinary Markdown and binary media are read without mangling percent/hash filenames', async () => {
  assert.equal((await readRepoFile(repo, 'README.md')).toString(), '# Read me');
  assert.deepEqual(await readRepoFile(repo, 'media/cover #100%.png'), Buffer.from([137,80,78,71,13,10,26,10]));
});

test('media reads only public image areas, including the actual target of inside-repository links', async () => {
  await fs.mkdir(path.join(repo,'images'));
  await fs.mkdir(path.join(repo,'private'));
  await fs.writeFile(path.join(repo,'images','screen.png'),'public fixture');
  await fs.writeFile(path.join(repo,'private','secret.png'),'private fixture');
  assert.equal((await readPublicMedia(repo,'images/screen.png')).toString(),'public fixture');
  for(const name of ['.git/config','borshkit/tasks/private.png','.local-run/private.png','private/secret.png','README.md','images/.hidden.png','images/log.txt']){
    await assert.rejects(readPublicMedia(repo,name),/outside public documentation media/);
  }
  const privateLink=path.join(repo,'images','private');
  await fs.symlink(path.join(repo,'private'),privateLink,process.platform==='win32'?'junction':'dir');
  links.push(privateLink);
  await assert.rejects(readPublicMedia(repo,'images/private/secret.png'),/Symlink target is outside public documentation media/);
  await fs.writeFile(path.join(outside,'secret.png'),'outside private fixture');
  const outsideLink=path.join(repo,'images','outside');
  await fs.symlink(outside,outsideLink,process.platform==='win32'?'junction':'dir');
  links.push(outsideLink);
  await assert.rejects(readPublicMedia(repo,'images/outside/secret.png'),/symlink escapes root/);
});

test('the real symlink target is checked before reading Markdown or media outside the repository', async () => {
  await assert.rejects(readRepoFile(repo, 'media/outside/secret.md'), /symlink escapes root/);
  await assert.rejects(readRepoFile(repo, '../outside/secret.md'), /Unsafe repository file/);
  await assert.rejects(readRepoFile(repo, path.join(outside, 'secret.md')), /Unsafe repository file/);
  await assert.rejects(readRepoFile(repo, 'media'), /not a file/);
});

test('a declared guide cannot symlink into undeclared private files inside the repository', async () => {
  await fs.writeFile(path.join(repo,'private','secret.md'),'private guide fixture');
  const guideLink=path.join(repo,'docs','private');
  await fs.symlink(path.join(repo,'private'),guideLink,process.platform==='win32'?'junction':'dir');
  links.push(guideLink);
  const sources=new Set(['README.md','docs/private/secret.md']);
  assert.equal((await readDocumentationSource(repo,'README.md',sources)).toString(),'# Read me');
  await assert.rejects(readDocumentationSource(repo,'docs/private/secret.md',sources),/Symlink target is outside declared public documentation sources/);
  sources.add('docs/.private.md');
  await fs.writeFile(path.join(repo,'docs','.private.md'),'hidden fixture');
  await assert.rejects(readDocumentationSource(repo,'docs/.private.md',sources),/File is outside declared public documentation sources/);
});

test('missing legitimate files still fail explicitly instead of silently removing images', async () => {
  await assert.rejects(readRepoFile(repo, 'media/missing.png'), { code: 'ENOENT' });
});

test('generated output can create inside directories but cannot follow an outside directory link', async () => {
  await writeRepoFile(repo, 'docs/read/new.html', '<main>Safe</main>');
  assert.equal((await readRepoFile(repo, 'docs/read/new.html')).toString(), '<main>Safe</main>');
  await assert.rejects(writeRepoFile(repo, 'media/outside/deep/leak.html', 'blocked'), /output symlink escapes root/);
  await assert.rejects(fs.stat(path.join(outside, 'deep')), { code: 'ENOENT' });
  await assert.rejects(writeRepoFile(repo, '../outside/secret.md', 'blocked'), /Unsafe repository file/);
  assert.equal(await fs.readFile(path.join(outside, 'secret.md'), 'utf8'), 'outside fixture: never publish');
});
