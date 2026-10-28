// Build the checked-in GitHub Pages site. Source Markdown remains canonical.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { languages } from './site/content.mjs';
import { page, homepage, escapeHtml, repoUrl } from './site/layout.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const e = escapeHtml;
const sources = [
  ...['README','README-RU','CHANGELOG','CHANGELOG-RU','ROADMAP','ROADMAP-RU','CONTRIBUTING','CONTRIBUTING-RU','CODE_OF_CONDUCT','CODE_OF_CONDUCT-RU'].map(name => `${name}.md`),
  ...(await fs.readdir(path.join(root,'docs'))).filter(name => name.endsWith('.md')).map(name => `docs/${name}`),
  'templates/README.md','demo-vault/README.md','obsidian-projects-types/README.md','obsidian-projects-types/README-RU.md',
];
const slug = text => text.toLowerCase().replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}\s-]/gu,'').trim().replace(/\s+/g,'-');
const stem = file => file.replace(/\.md$/i,'').toLowerCase().replaceAll('/','-');
const urls = new Map(sources.map(source => [source, `read/${source.startsWith('docs/') ? stem(source.slice(5)) : stem(source)}.html`]));
const outputs = new Map();
const media = new Map();
const index = [];
const safeUrl = href => [...href].every(c=>c.charCodeAt(0)>32) && (!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href) || /^(?:https?:|mailto:)/i.test(href));
function resolveLink(source, href, image = false) {
  if (!safeUrl(href)) return '';
  if (/^(?:https?:|mailto:|#)/i.test(href)) return href;
  const [filename, hash = ''] = href.split('#');
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(source), decodeURI(filename)));
  if (resolved.startsWith('../') || path.posix.isAbsolute(resolved)) return '';
  if (image) {
    const target = `media/${resolved.replaceAll('/','--')}`;
    media.set(target, resolved);
    return `../${target}${hash ? '#'+hash : ''}`;
  }
  if (urls.has(resolved)) return `../${urls.get(resolved)}${hash ? '#'+hash : ''}`;
  return `${repoUrl}/blob/main/${resolved.split('/').map(encodeURIComponent).join('/')}${hash ? '#'+hash : ''}`;
}
for (const source of sources) {
  const markdown = (await fs.readFile(path.join(root,source),'utf8')).replace(/^\uFEFF/,'');
  const lang = /-RU\.md$/.test(source) || ['docs/user-guide.md','docs/architecture.md'].includes(source) ? 'ru' : 'en';
  const t = languages[lang];
  const title = /^#\s+(.+)$/m.exec(markdown)?.[1] || source;
  const headings = []; const used = new Map();
  const marked = new Marked({ gfm:true, renderer: {
    html({text}) { return e(text); },
    heading({tokens,depth,text}) {
      const base = slug(text); const count = used.get(base) || 0; used.set(base,count+1);
      const id = `${base}${count?'-'+count:''}`;
      if(depth===2)headings.push({id,text});
      return `<h${depth} id="${e(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
    link({href,title,tokens}) {
      const url = resolveLink(source,href);
      return url ? `<a href="${e(url)}"${title?` title="${e(title)}"`:''}>${this.parser.parseInline(tokens)}</a>` : this.parser.parseInline(tokens);
    },
    image({href,title,text}) {
      const url = resolveLink(source,href,true);
      return url ? `<img src="${e(url)}" alt="${e(text)}" loading="lazy" decoding="async"${title?` title="${e(title)}"`:''}>` : e(text);
    },
  }});
  const html = marked.parse(markdown);
  const nav = headings.map(h=>`<a href="#${e(h.id)}">${e(h.text)}</a>`).join('');
  let twin = source.includes('-RU.md') ? source.replace('-RU.md','.md') : source.includes('-EN.md') ? source.replace('-EN.md','.md') : `${source.slice(0,-3)}-RU.md`;
  if(['docs/user-guide.md','docs/architecture.md'].includes(source))twin=source.replace('.md','-EN.md');
  const body = `<main id="main" class="doc-layout"><aside class="doc-sidebar"><a href="../${t.home}">${t.back}</a><strong>${t.contents}</strong><nav aria-label="${t.contents}">${nav}</nav></aside><article class="doc-article"><p class="doc-version">${t.docVersion}</p>${html}<p class="doc-source"><a href="${repoUrl}/blob/main/${source}">${t.source} ↗</a></p></article></main>`;
  const url = urls.get(source);
  outputs.set(url,page({lang,t,title,description:title,body,prefix:'../',canonical:url,alternate:urls.has(twin)?`../${urls.get(twin)}`:`../${t.alternate}`}));
  const text=markdown.replace(/```[^]*?```/g,' ').replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[#*`>|_]+/g,' ').replace(/\s+/g,' ').trim();
  index.push({title,lang,url,text});
  // The two deliberately bilingual indexes are useful to searches in either language.
  if(['docs/README.md','docs/ERROR_CODES.md','templates/README.md','demo-vault/README.md'].includes(source)) index.push({title,lang:lang==='ru'?'en':'ru',url,text});
}
for (const [target,source] of media) outputs.set(target,await fs.readFile(path.join(root,source)));
for(const [lang,t] of Object.entries(languages))outputs.set(t.home,page({lang,t,title:t.title,description:t.description,body:homepage(lang,t),canonical:t.home}));
outputs.set('search-index.json',JSON.stringify(index)+'\n');
outputs.set('.nojekyll','');
const manifest={schemaVersion:1,sourceVersion:JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,
  generator:'node scripts/build-docs-site.mjs',sources,files:[...outputs].map(([name,content])=>({name,sha256:crypto.createHash('sha256').update(content).digest('hex')}))};
outputs.set('site-manifest.json',JSON.stringify(manifest,null,2)+'\n');
const stale=[];
for (const [relative,content] of outputs) {
  const target=path.join(root,'docs',relative);
  if(check){ const actual=await fs.readFile(target).catch(()=>null);if(!actual||!actual.equals(Buffer.from(content)))stale.push(relative); }
  else { await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,content); }
}
if(stale.length){console.error(`Generated documentation is stale: ${stale.join(', ')}. Run node scripts/build-docs-site.mjs.`);process.exitCode=1;}
else console.log(`${check?'Checked':'Built'} ${outputs.size} static files for main/docs.`);
