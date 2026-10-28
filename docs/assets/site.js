// Progressive enhancement only. Navigation and documentation remain static.
const lang = document.body.dataset.language === 'ru' ? 'ru' : 'en';
const prefix = document.body.dataset.prefix || '';
const labels = lang === 'ru'
  ? { names: ['Собрать идеи','Подготовить встречу','Подвести итоги'], statuses: ['Запланировано','В работе','Готово'], columns: ['Заметка','Статус','Дата'], download: 'Пример.md' }
  : { names: ['Collect ideas','Prepare a meeting','Review the week'], statuses: ['Planned','In progress','Done'], columns: ['Note','Status','Date'], download: 'Example.md' };
const notes = labels.names.map((name, i) => ({ name, status: i, date: `2026-10-${28+i}`, minutes: [30,60,15][i] }));
let currentView = 'table';
let selectedNote = 0;
const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const markdown = note => `---\nstatus: ${['planned','in-progress','done'][note.status]}\nstartDate: ${note.date}\nminutes: ${note.minutes}\n---\n\n# ${note.name}\n`;
function renderDemo() {
  const target = document.getElementById('demo-view');
  if (!target) return;
  const contents = document.createDocumentFragment();
  if (currentView === 'table') {
    const table = make('table', undefined, 'demo-table');
    const head = make('thead'); const heading = make('tr');
    labels.columns.forEach(title => heading.append(make('th', title)));
    head.append(heading); table.append(head);
    const body = make('tbody');
    notes.forEach((note, i) => {
      const row = make('tr'); const select = make('select');
      select.dataset.note = String(i);
      select.setAttribute('aria-label', `${note.name}: ${labels.columns[1]}`);
      labels.statuses.forEach((status, j) => { const option = make('option', status); option.value = String(j); select.append(option); });
      select.value = String(note.status);
      const statusCell = make('td'); statusCell.append(select);
      row.append(make('td', note.name), statusCell, make('td', note.date)); body.append(row);
    });
    table.append(body); contents.append(table);
  } else if (currentView === 'board') {
    const board = make('div', undefined, 'demo-board');
    labels.statuses.forEach((status, i) => {
      const column = make('section', undefined, 'demo-column'); column.append(make('h3', status));
      notes.filter(note => note.status === i).forEach(note => {
        const card = make('div', note.name, 'demo-card'); card.append(make('small', note.date)); column.append(card);
      }); board.append(column);
    }); contents.append(board);
  } else {
    const calendar = make('div', undefined, 'demo-calendar');
    notes.forEach(note => { const day = make('div', undefined, 'demo-day'); day.append(make('strong', note.date.slice(-2)), make('p', note.name), make('p', `${note.minutes} min`)); calendar.append(day); });
    contents.append(calendar);
  }
  target.replaceChildren(contents);
  const source = document.getElementById('demo-markdown');
  if (source) source.textContent = markdown(notes[selectedNote]);
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  currentView = button.dataset.view;
  document.querySelectorAll('[data-view]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  renderDemo();
}));
document.getElementById('demo-view')?.addEventListener('change', event => {
  const select = event.target;
  if (!(select instanceof window.HTMLSelectElement) || select.dataset.note === undefined) return;
  const i = Number(select.dataset.note), status = Number(select.value);
  if (!notes[i] || ![0,1,2].includes(status)) return;
  notes[i].status = status; selectedNote = i;
  document.getElementById('demo-markdown').textContent = markdown(notes[i]);
});
document.getElementById('download-note')?.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([markdown(notes[selectedNote])], { type: 'text/markdown;charset=utf-8' }));
  const link = make('a'); link.href = url; link.download = labels.download;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  const category = button.dataset.filter;
  let count = 0;
  document.querySelectorAll('[data-category]').forEach(card => { card.hidden = category !== 'all' && card.dataset.category !== category; if (!card.hidden) count++; });
  document.querySelectorAll('[data-filter]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  document.getElementById('filter-status').textContent = lang === 'ru' ? `Сценариев: ${count}` : `${count} workflows`;
}));
document.getElementById('copy-path')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  const status = document.getElementById('copy-status');
  try { await navigator.clipboard.writeText(document.getElementById('install-path').textContent); status.textContent = button.dataset.success; }
  catch { status.textContent = button.dataset.failure; }
});
const search = document.getElementById('doc-search');
const results = document.getElementById('search-results');
const searchStatus = document.getElementById('search-status');
let indexPromise;
function loadIndex() {
  if (!indexPromise) indexPromise = fetch(`${prefix}search-index.json`).then(response => { if (!response.ok) throw new Error('search index'); return response.json(); }).catch(error => { indexPromise = undefined; throw error; });
  return indexPromise;
}
let searchGeneration = 0;
search?.addEventListener('input', async () => {
  const generation = ++searchGeneration;
  const query = search.value.trim().toLocaleLowerCase();
  results.replaceChildren(); results.hidden = true; searchStatus.textContent = '';
  if (!query) return;
  try {
    const index = await loadIndex();
    if (generation !== searchGeneration) return;
    const words = query.split(/\s+/);
    const hits = index.filter(entry => entry.lang === lang && words.every(word => `${entry.title} ${entry.text}`.toLocaleLowerCase().includes(word))).slice(0,8);
    hits.forEach(hit => { const item = make('li'); const link = make('a', hit.title); link.href = prefix + hit.url; item.append(link, make('small', hit.text.slice(0,160))); results.append(item); });
    results.hidden = !hits.length;
    searchStatus.textContent = hits.length ? `${hits.length} ${lang === 'ru' ? 'результатов' : 'results'}` : searchStatus.dataset.empty;
  } catch { if (generation === searchGeneration) searchStatus.textContent = lang === 'ru' ? 'Поиск недоступен. Откройте руководство по ссылке в меню.' : 'Search is unavailable. Open the guide from the menu.'; }
});
document.addEventListener('keydown', event => {
  if (event.isComposing) return;
  const editing = event.target.closest?.('input,textarea,select,[contenteditable=true]');
  if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); search?.focus(); search?.scrollIntoView({ block: 'center' }); }
  if (event.key === 'Escape' && event.target === search) { search.value = ''; searchGeneration++; results.replaceChildren(); results.hidden = true; searchStatus.textContent = ''; }
});
