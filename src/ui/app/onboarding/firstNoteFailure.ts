/**
 * Scene 7 — which Notice to show when the onboarding flow's first record
 * fails to be written in full.
 *
 * `DataApi.createNote` (`src/lib/dataApi.ts`) creates the Markdown file
 * with `fileSystem.create` and only afterwards writes its front matter
 * with a separate `updateFile` call. A rejection can therefore arrive
 * after the note file already exists — telling the user the table is
 * still empty and to add the record again would be false in that case:
 * the note is there, only its properties never made it in. The caller
 * checks whether the file exists at the record's path and passes the
 * answer here; both messages use the `{{name}}` placeholder the caller
 * fills in.
 */

export interface FirstNoteFailureMessage {
  readonly key: string;
  readonly defaultValue: string;
}

export function firstNoteFailureMessage(fileExists: boolean): FirstNoteFailureMessage {
  if (fileExists) {
    return {
      key: "onboarding.profiles.first-note-partial",
      defaultValue:
        'Запись «{{name}}» была создана, но не удалось записать её свойства — откройте её и проверьте.',
    };
  }
  return {
    key: "onboarding.profiles.first-note-failed",
    defaultValue:
      'Не удалось создать первую запись «{{name}}». Добавьте её вручную кнопкой «Добавить первую запись» в пустой таблице.',
  };
}
