# CX-REVIEW-200-followup — the code that landed after the pre-merge gate

Run 2026-09-08, `review --base f49e988 --scope branch` on `main` (17 files, +725/-61).

Why it exists: the pre-merge review ran at `f49e988`, and two commits with CODE landed after it — `83abc43` (the implementation of that review's own findings) and `8d13d84` (#210). The merge therefore had a gate covering an earlier state, which is what this run closes.

Three findings, two P1. All three held; fixed on `fix/211-conflict-races`.

```
The new conflict-handling paths still permit races that overwrite an external settings version before it is preserved, and one recovery fallback can point users at the wrong file.

Full review comments:

- [P1] Do not drain arbitrary queued writes after divergence — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:282-282
  When another writer replaces `data.json` while a save is in flight and a normal settings edit is queued, this immediately writes the queued value before `onExternalSettingsChange` has necessarily read and copied the external version. The event handler and verification both perform asynchronous reads, so the follow-up can win that race and erase the other writer's changes without creating a conflict copy; only a reconciliation-authorized restore should bypass the normal debounce here.

- [P1] Block in-flight writes before offering manual conflict recovery — C:\Users\Park\OBSv1.0\obs-projects-plus\src\main.ts:742-742
  If preserving the external version fails while a settings save is already in flight, `hold()` only cancels timers; it cannot stop that in-flight save from completing afterward and overwriting `data.json`. In that timing, PPP-106 tells the user to copy the file manually, but the file may already have been replaced by this session's settings. Fence or await in-flight work before issuing this fallback.

- [P2] Do not direct recovery to an already overwritten data.json — C:\Users\Park\OBSv1.0\obs-projects-plus\src\main.ts:851-855
  When a nonempty unparsable payload is captured, a local save completes during the recheck delay, and `writeConflictCopy` then fails, `preserveConflicting(seen, ...)` emits PPP-106 instructing the user to copy `data.json` by hand. At this point `data.json` is the confirmed local payload, not `seen`, so the instruction cannot recover the external bytes and the original version is lost; this branch needs a distinct failure path or must prevent that overwrite before the fallback is shown.

[exited with code 0]
```

## Второй проход — ревью самой ветки `fix/211-conflict-races` (base `main`)

Две находки, обе верные, исправлены в `6a79b94`.

```
 11 files changed, 223 insertions(+), 20 deletions(-)

Full review comments:

- [P1] Fence ordinary writes until the external version is preserved — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:313-315
  When a normal edit is queued behind a write that verifies as `diverged`, this re-arms its 400 ms timer without coordinating with `onExternalSettingsChange`. The host callback/read and `writeConflictCopy` are asynchronous, so that timer can fire before the handler has read or copied the external `data.json`, overwriting it with no recovery copy. Do not release/re-arm the ordinary write until reconciliation has preserved or explicitly handled the external payload.

- [P2] Clear the immediate marker when a normal edit supersedes it — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:379-385
  If `pushImmediate()` is called while a write is in flight and the user then makes an ordinary edit before that write resolves, `push()` replaces `latest` but leaves `immediate` true. On divergence, `onWritten()` therefore writes the user's ordinary edit immediately instead of honoring the debounce, reintroducing the race this split is intended to avoid. Reset the marker in `push()` or track the mode together with the queued value.

[exited with code 0]
```

## Третий проход — та же ветка после правок второго

Две находки, обе верные, исправлены в коммите ниже.

```
- [P1] Preserve deferred conflicts during shutdown — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:364-369
  When a normal edit is deferred after a diverged in-flight write and the user disables or quits within the backstop window, `onunload`/the quit handler calls `flush()`, whose forced write ignores `deferred` and saves the local value immediately. If the external-change hook has not run yet, this overwrites the external `data.json` before any conflict copy exists—the race this deferral is meant to prevent. Make shutdown respect the deferred state or preserve the external payload before forcing the write.

- [P2] Update the PPP-106 localized cause — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\errors\errorCodes.ts:177-181
  For English users, `resolveError` selects the existing `errors.causes.settings-conflict-uncopied` translation, which still says `data.json` is the only copy instead of using this updated default. The persistent PPP-106 chip tooltip therefore contradicts the notice and can send users to an already-overwritten file rather than the console recovery payload. Update that localized cause to match the new recovery path.

[exited with code 0]
```

## Четвёртый проход — после правок третьего

Одна находка (P2), верная.

```
- [P2] Provide a mobile recovery path for PPP-106 — C:\Users\Park\OBSv1.0\obs-projects-plus\src\main.ts:912-914
  When conflict-copy creation fails on mobile, this makes the external settings payload recoverable only through the desktop developer console. The plugin declares `isDesktopOnly: false`, but Obsidian mobile has no Ctrl+Shift+I console, so affected users have no supported way to retrieve the raw version after the notice says `data.json` may already have been overwritten. Surface the payload through an in-app/copyable recovery path as well.

[exited with code 0]
```

## Пятый проход — после правок четвёртого

Одна находка (P2), верная.

```

- [P2] Keep recovery notes out of project sources — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\brokenBackup.ts:220-220
  When a project uses the vault root as its folder source, this root-level `.md` file is included by `FolderDataSource` and becomes a normal record in its views and aggregations, despite the note claiming that nothing else reads it. Store the recovery payload outside queried vault notes or ensure generated recovery paths are excluded.

[exited with code 0]
```

## Шестой проход — после правок пятого

Одна находка (P1), верная.

```
- [P1] Suspend queued writes before awaiting conflict preservation — C:\Users\Park\OBSv1.0\obs-projects-plus\src\main.ts:748-749
  When an external update arrives while a normal local edit is still in its debounce window, `settled()` returns immediately because no write is in flight, but it does not cancel that queued timer. The timer can then start and overwrite `data.json` while `preserveConflicting` is still awaiting its copy/note writes; if those recovery writes fail, the later `hold()` cannot stop the already-running save, so PPP-106 falsely claims this session did not overwrite the external version (and mobile has no remaining recovery path). Suspend the queued write before awaiting/preserving, not only after preservation fails.

[exited with code 0]
```

## Седьмой проход — после правок шестого

Одна находка (P1), верная. Исправлена сведением двух механизмов в один, а не ещё одной заплаткой.

```
- [P1] Keep deferred edits resumable when fencing unparsable conflicts — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:472-472
  When a local write diverges with an ordinary edit queued behind it, that edit is marked `deferred`. If the external file remains nonempty but unparsable at recheck, `onUnparsableSettlement()` calls `hold()` before preserving it and `resume()` afterward; this `cancelDefer()` clears the marker, so `resume()` returns without rearming any timer. The latest local settings remain dirty but are not written until another edit or shutdown, and can therefore be lost in an interrupted session.

[exited with code 0]
```

## Восьмой и девятый проходы

Восьмой — одна находка (P3), документация. Девятый — одна (P1), координация.

```
- [P3] Correct PPP-105 guidance for note-based recovery — src/main.ts:922-928
  When the sibling conflict copy fails but this new note fallback succeeds, PPP-105 names a recovery
  note under `Projects+ recovery` (or at the vault root), while `docs/ERROR_CODES.md:161-162` still
  tells users that the named file is next to `data.json`. Update that guidance to follow the path in
  the notice and distinguish the Markdown-note recovery path.

- [P1] Resume the writer before restoring unresolved settings — C:\Users\Park\OBSv1.0\obs-projects-plus\src\main.ts:786-786
  When an externally changed v4 settings payload has an invalid project or view so `migrateSettings` returns `Left`, this branch has already called `hold()`, leaving the writer suspended. After preserving the external payload, `pushImmediate()` cannot start because `startWrite()` returns while suspended, and unlike the normal conflict branch this path never calls `resume()`. The in-memory settings then remain dirty and are neither restored to disk nor flushed on shutdown until another settings edit occurs.

[exited with code 0]
```

## Десятый проход — после правок девятого

Одна находка (P2), верная.

```
- [P2] Publish the uncopied-conflict status code — src/main.ts:758
  When preserving a conflict fails after the new initial `hold(SETTINGS_CONFLICT)`, this second hold
  cannot update the status: `sameStatus` treats any two `diverged` states as equal, so the standing
  chip remains `PPP-105` even though the notice and actual recovery state are `PPP-106`. This occurs
  for a pending debounced edit plus an external change when both backup writes fail, and leaves the
  persistent UI claiming the other version was preserved when it was not.
```

## Одиннадцатый проход — покрывает `HEAD` (правило Gate 3)

Одна находка (P1), верная. После неё цикл остановлен по стоп-правилу.

```
- [P1] Keep the divergence suspension on empty updates — src/main.ts:709-716
  If a normal edit is suspended after a diverged write, then a non-atomic synchronizer exposes a
  transient empty `data.json`, this `resume()` re-arms the local edit after the debounce. A slow or
  stalled external writer can then have its eventual payload overwritten before
  `onUnparsableSettlement` has a chance to preserve it. Leave the writer suspended through the
  empty-file recheck (with the existing backstop), rather than treating the first empty event as
  resolved.
```

## Ревью шага F — P1 в композиции, которую юнит-тесты увидеть не могли

```
 26 files changed, 2763 insertions(+), 327 deletions(-)

- [P1] Keep the fence out of pending-state accounting — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:639-639
  Do not publish `diverged` before calling the reconciliation body: `hasPending()` treats that status as unsaved local state, so the subsequent `reconcileSettings()` call always sees `pending: true`. Consequently, a clean window receiving a valid external settings update takes the conflict/restore path and overwrites the external update instead of adopting it. Keep fencing separate from the public diverged status, or exclude the temporary fence status from `hasPending()`.

[exited with code 0]
```

## Ревью после шага F (повтор, ) — две P1

```
  When verification reports `diverged` with no value already queued, this branch leaves the permit open. If the user changes settings before Obsidian dispatches `onExternalSettingsChange` (or that hook is delayed), `push` schedules a write after the debounce and overwrites the external `data.json` before reconciliation can preserve it. Enter the fenced state for every divergence, not only when `queue` is non-null.

- [P1] Serialize overlapping reconciliation episodes — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:666-669
  When two external settings notifications arrive while an adapter read or conflict copy is awaiting, both calls enter `withExclusive`; fencing only changes shared state and does not wait for the preceding body. The later call therefore treats the first fence as pending, and the handlers can interleave writes to the shared `pendingAdoption`, causing an older external version to be adopted/restored while a newer one is merely copied even when this window had no edits. Queue or coalesce external-change episodes so only one body and adoption publication run at a time.

[exited with code 0]
```

## Ревью после T8-правки — одна P1

```
- [P1] Keep a disposed writer closed when a lease resolves — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:426-427
  When the plugin unloads while an external-change lease is awaiting a read/copy, `dispose()` sets the permit to `closed`, but the lease subsequently reaches this branch and calls `toOpen()` (and a `restore` then calls `startWrite()`). This can resume persistence and overwrite `data.json` after the plugin has been disabled; guard outcome application against `closed` so pending leases cannot reopen it. This contradicts the stated closed-state contract in `docs/internal/PLAN_212_WRITE_PERMIT_2026-09-08.md:67`.

[exited with code 0]
```

## Ревью после правки `closed` — одна P1

```
- [P1] Do not advance the user-edit epoch for internal pushNow writes — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:692-692
  When two external changes arrive close together and the first adoption carries a higher `uniqueIdCounter`, the first callback's automatic `pushNow(adoption.settings)` runs while the second lease is deciding. This increments `epoch`, so the second lease rejects its otherwise valid adoption as if the user had edited, then schedules the older first-adoption value and overwrites the newer external file without preserving it. Keep the epoch for actual user edits only, or distinguish internal carry/migration writes from user-originated changes.

[exited with code 0]
```

## Ревью после правки эпохи — одна P1

```
- [P1] Do not release a still-empty externally written file — C:\Users\Park\OBSv1.0\obs-projects-plus\src\main.ts:833-839
  If a synchronizer leaves `data.json` truncated for more than the recheck interval, this releases the lease immediately rather than waiting for the file to settle or for the writer backstop. A queued local save is then scheduled and can overwrite the external payload once it arrives, despite the `keep` decision being explicitly non-resolving.

[exited with code 0]
```

## Ревью после ограничения ожиданий — одна P2

```
- [P2] Cancel extended reconciliation waits on disposal — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:749-753
  If the plugin is disabled during an `extend` episode, `dispose()` clears the permit timer but not this independently-created timeout. Once it fires, `next(entry)` can read the vault and, for an unreadable external payload, write a conflict copy/note and show a notice after the plugin has been unloaded. Track and clear this continuation timer, or stop before invoking `next` when the writer is closed.

[exited with code 0]
```

## Ревью после правки таймера продолжения — одна P1

```
- [P1] Keep the fence when the settlement read fails — C:\Users\Park\OBSv1.0\obs-projects-plus\src\main.ts:846-847
  If an external write first yields nonempty unparsable bytes and the delayed adapter read then fails transiently (for example while a synchronizer still holds the file), this returns `release`. That opens the writer and schedules any queued local edit even though the external bytes were never copied aside, so it can overwrite the only other version. Treat this as an unresolved episode (or preserve the initially captured bytes) rather than releasing it.

[exited with code 0]
```

## Ревью после «чтение не удалось» — одна P2, третья того же рода

```

- [P2] Stop queued leases after disposal before running their callback — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\settings\settingsWriter.ts:733-733
  When two external-settings events arrive close together, the second lease waits here while the first is deciding. If the plugin is disabled during that wait, `dispose()` sets the permit to `closed`, but this method then continues into `body(entry)` after `previous` resolves. That body can still read the vault, write a conflict backup/note, and show a Notice after the plugin has been unloaded. Return a release outcome after this wait when the permit is closed (and before invoking the body).

[exited with code 0]
```

## Ревью после инверсии умолчания — одна P2 (дисциплина документа)

```

- [P2] Remove branch Jest counts from the backlog — C:\Users\Park\OBSv1.0\obs-projects-plus\docs\internal\BACKLOG.md:5558-5558
  The `233 suites / 3591 tests` gate result is a durable copy of the Jest baseline outside its designated canonical location; the nearby `231/3567` count has the same problem. These figures will become stale as the branch changes and violate the project rule that the baseline lives only in `CONTEXT.md`; retain the gate status without copying suite/test totals. [CLAUDE.md:82-90]

[exited with code 0]
```

## Ревью после чистки базиса — одна P2 (текст выводил лишнее)

```

- [P2] Do not infer a vault-wide write failure — C:\Users\Park\OBSv1.0\obs-projects-plus\src\lib\errors\errorCodes.ts:180-181
  `PPP-106` is reached when these two particular recovery writes fail, which does not establish that every vault write fails: for example, an unknown `manifest.dir` skips the sibling-copy attempt and a path-specific failure can reject the recovery note while `saveData` remains usable. Telling the user that their settings cannot be saved sends them toward unnecessary storage troubleshooting and contradicts the writer's behavior, which permits a later user edit to retry. This recovery text must describe only the failed preservation paths. `CLAUDE.md:59-62`.

[exited with code 0]
```
