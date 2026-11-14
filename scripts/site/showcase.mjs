// Maintainer-supplied desktop and iPhone captures, 14 November 2026.
// Originals stay unchanged in images/; the generator copies public media to Pages.
export const screenshots = {
  pc: [
    ['2026-11-14_11-00-55.png', 'Обзор практики: показатели и графики', 'Practice overview: metrics and charts'],
    ['2026-11-14_11-01-53.png', 'Календарь встреч и настройки события', 'Appointments and event settings'],
    ['2026-11-14_11-02-09.png', 'Свойства события и палитра', 'Event properties and color palette'],
    ['2026-11-14_11-02-44.png', 'Расписание на день', 'Daily schedule'],
    ['2026-11-14_11-03-06.png', 'Карточки на доске Kanban', 'Notes on a Kanban board'],
    ['2026-11-14_11-03-25.png', 'Галерея связанных записей', 'Gallery of linked records'],
    ['2026-11-14_11-03-56.png', 'Аналитика и несколько диаграмм', 'Analytics with multiple charts'],
  ],
  mobile: [
    ['photo_1_2026-11-14_11-10-08.jpg', 'Планирование на iPhone', 'Planning on iPhone'],
    ['photo_2_2026-11-14_11-10-08.jpg', 'Календарь на год', 'Year calendar'],
    ['photo_3_2026-11-14_11-10-08.jpg', 'Диаграмма расходов', 'Expense chart'],
    ['photo_4_2026-11-14_11-10-08.jpg', 'Галерея карточек', 'Card gallery'],
    ['photo_5_2026-11-14_11-10-08.jpg', 'Доска проекта', 'Project board'],
    ['photo_6_2026-11-14_11-10-08.jpg', 'Расписание на неделю', 'Weekly schedule'],
    ['photo_7_2026-11-14_11-10-08.jpg', 'Показатели и график на телефоне', 'Metrics and chart on a phone'],
  ],
};
export const screenshotPath = (device, file) => `media/images--${device}--${file}`;
export const supportUrl = 'https://web.tribute.tg/d/Sh6';

export function showcase(lang) {
  const ru = lang === 'ru';
  return `<section class="showcase-section" id="screenshots" aria-labelledby="showcase-title"><div class="section-intro"><p class="eyebrow">PROJECTS PLUS / ${ru ? 'В ДЕЛЕ' : 'IN ACTION'}</p><h2 id="showcase-title">${ru ? 'Ваша система. На любом экране.' : 'Your system. On every screen.'}</h2><p>${ru ? 'Настоящие скриншоты приложения: от общей картины проекта до следующей встречи. Листайте или откройте снимок, чтобы рассмотреть детали.' : 'Real app screenshots: from the bigger picture to the next appointment. Browse or open an image to see the details.'}</p></div><div class="showcase-grid">${Object.entries(screenshots).map(([device, shots]) => {
    const title = device === 'pc' ? (ru ? 'На компьютере' : 'On desktop') : (ru ? 'На iPhone' : 'On iPhone');
    return `<section class="screenshot-carousel ${device}" data-carousel aria-label="${title}"><div class="carousel-heading"><h3>${title}</h3><div class="carousel-controls" hidden><button type="button" data-previous aria-label="${title}: ${ru ? 'предыдущий снимок' : 'previous image'}" aria-controls="shots-${device}">←</button><span data-count aria-live="polite" aria-atomic="true">1 / ${shots.length}</span><button type="button" data-next aria-label="${title}: ${ru ? 'следующий снимок' : 'next image'}" aria-controls="shots-${device}">→</button></div></div><div class="screenshot-track" id="shots-${device}" tabindex="0" aria-label="${ru ? 'Галерея, можно листать' : 'Scrollable gallery'}">${shots.map(([file, captionRu, captionEn], i) => {
      const caption = ru ? captionRu : captionEn;
      return `<figure class="screenshot-slide"><a href="${screenshotPath(device, file)}" data-expand aria-label="${caption} — ${ru ? 'увеличить' : 'enlarge'}"><img src="${screenshotPath(device, file)}" alt="${caption}" loading="lazy" decoding="async"></a><figcaption><span>${String(i + 1).padStart(2, '0')} / ${caption}</span><a href="${screenshotPath(device, file)}">${ru ? 'Оригинал ↗' : 'Original ↗'}</a></figcaption></figure>`;
    }).join('')}</div></section>`;
  }).join('')}</div><p class="capture-note">${ru ? 'Снимки предоставлены автором 14.11.2026: ПК и настоящий iPhone. Вид интерфейса зависит от темы и настроек Obsidian.' : 'Captured by the maintainer on 14 November 2026: desktop and a physical iPhone. Appearance depends on your Obsidian theme and settings.'}</p><dialog class="screenshot-dialog" aria-label="${ru ? 'Просмотр скриншота' : 'Screenshot viewer'}"><button type="button" data-close-image aria-label="${ru ? 'Закрыть скриншот' : 'Close screenshot'}">${ru ? 'Закрыть' : 'Close'} ×</button><img alt="Screenshot"><p></p></dialog></section>`;
}

export function support(lang) {
  const ru = lang === 'ru';
  return `<section class="support-section" id="support" aria-labelledby="support-title"><div><p class="eyebrow">${ru ? 'СОЗДАЁМ ВМЕСТЕ' : 'BUILT TOGETHER'}</p><h2 id="support-title">${ru ? 'Помогите проекту расти.' : 'Help the project grow.'}</h2><p>${ru ? 'Projects Plus — открытый проект Park Pavel. Если он помогает вам в работе, поддержите разработку: новые возможности, исправления и понятную документацию.' : 'Projects Plus is an open-source project by Park Pavel. If it helps your work, support its development: new features, fixes and clear documentation.'}</p></div><div class="support-actions"><a class="button primary" href="${supportUrl}">♡ ${ru ? 'Поддержать через Tribute' : 'Support via Tribute'} ↗</a><a class="text-link" href="${supportUrl}">${ru ? 'Открыть страницу поддержки' : 'Open the support page'}</a><p>${ru ? 'Идеи и обратная связь тоже важны.' : 'Ideas and feedback matter too.'}</p><a class="text-link" href="https://github.com/ParkPavel/obs-projects-plus/issues/new">${ru ? 'Предложить улучшение →' : 'Suggest an improvement →'}</a></div></section>`;
}
