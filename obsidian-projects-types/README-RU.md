# Типы пользовательских видов

[English](README.md)

В этом пакете лежат базовый класс `ProjectView` и объявления TypeScript, которыми пользуются сторонние виды для Projects Plus. Он происходит от расширения пользовательских видов в [Obsidian Projects](https://github.com/marcusolsson/obsidian-projects) Marcus Olsson.

Начните с [русского справочника API](../docs/api-RU.md) или [English API reference](../docs/api.md): там регистрация, жизненный цикл и пример.

## Совместимость

API экспериментальный. Этот каталог объявляет версию пакета `3.0.0` — она не совпадает с версией плагина. Собираясь под конкретный выпуск, сравните [index.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/obsidian-projects-types/index.ts) с [customViewApi.ts](https://github.com/ParkPavel/obs-projects-plus/blob/main/src/customViewApi.ts) хоста. Пакет не является полной копией текущего хоста: в нём, в частности, нет `updateProps` и полного описания фильтров. Различия, важные автору вида, описаны в справочнике API.

Используйте экземпляр `viewApi`, который передаёт хост. Класс из этого пакета содержит пустые тела методов — он нужен для типизации: его создание не даёт работающей службы сохранения, а его идентичность не совпадает с идентичностью реализации хоста.

## Лицензия

[package.json](https://github.com/ParkPavel/obs-projects-plus/blob/main/obsidian-projects-types/package.json) объявляет для этого пакета лицензию MIT. При распространении сохраняйте применимые указания авторства. У самого плагина своя [лицензия Apache 2.0](https://github.com/ParkPavel/obs-projects-plus/blob/main/LICENSE).
