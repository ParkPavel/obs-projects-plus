# API своих представлений (экспериментальное)

> Русский · [English](README.md)

**СТАТУС: ЭКСПЕРИМЕНТАЛЬНОЕ И НЕСТАБИЛЬНОЕ**

Через это API сторонний плагин может добавить в Projects Plus своё представление — оно появится
в списке рядом со встроенными.

**⚠️ Предупреждение: API может меняться без сохранения совместимости.**

Берите его только если:

- готовы сопровождать свой плагин при несовместимых изменениях;
- понимаете, что API может быть переписано или убрано;
- готовы к тому, что обновление плагина сломает ваш.

Если вы делаете представление для Projects Plus, напишите мейнтейнеру — так проще предупредить
вас об изменениях заранее.

## Как сделать своё представление

### Установите типы

```bash
npm install --save-dev obsidian-projects-types@latest
```

```bash
yarn add --dev obsidian-projects-types@latest
```

### Зарегистрируйте представление

1. Создайте класс — наследник `ProjectView`.
2. Добавьте в своём плагине метод `onRegisterProjectView`, который возвращает новый экземпляр
   этого класса.

Пример:

```ts
import { Plugin } from "obsidian";
import {
  DataQueryResult,
  ProjectView,
  ProjectViewProps,
} from "obsidian-projects-types";

class MySampleView extends ProjectView {
  dataEl?: HTMLElement;

  getViewType(): string {
    return "my-sample-view";
  }

  getDisplayName(): string {
    return "Sample view";
  }

  getIcon(): string {
    return "apple";
  }

  // onData вызывается каждый раз, когда данные обновились — по любой причине.
  // На каждом вызове считайте прежние данные недействительными.
  //
  // `data`        разобранные данные проекта.
  async onData({ data }: DataQueryResult) {
    if (this.dataEl) {
      this.dataEl.empty();
      this.dataEl.createDiv({ text: JSON.stringify(data.fields) });
      this.dataEl.createDiv({ text: JSON.stringify(data.records) });
    }
  }

  // onOpen вызывается, когда пользователь открывает ваше представление.
  //
  // `contentEl`    элемент, в который можно вставить свой интерфейс.
  // `config`       объект JSON с настройкой представления, если она есть.
  // `saveConfig`   обратный вызов для сохранения настройки.
  // `readonly`     если true, отключите всё, что меняет данные. Сейчас readonly
  //                включается для проектов на Dataview, где поля могут быть
  //                вычисляемыми.
  async onOpen({ contentEl, config, saveConfig, readonly }: ProjectViewProps) {
    contentEl.createEl("h1", { text: "My Sample View" });

    this.dataEl = contentEl.createEl("div");
  }

  // onClose вызывается, когда пользователь уходит с представления или удаляет
  // его. Освободите здесь всё, что создали.
  async onClose() {
    // очистка
  }
}

export default class MyPlugin extends Plugin {
  // Этот метод вызывает Projects Plus, чтобы зарегистрировать ваше
  // представление. Он может быть вызван несколько раз.
  onRegisterProjectView = () => new MySampleView();
}
```

Подробнее о контракте — [docs/api-RU.md](../docs/api-RU.md).
