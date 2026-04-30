# Documentation Archive

This folder contains historical documents kept for context and traceability. **They are not authoritative** for current work and may contradict the active state of the project.

For the current state, always start from [docs/DOCS_INDEX.md](../DOCS_INDEX.md) and the master architecture document [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Contents

| File | Original purpose | Superseded by | Archived on |
|---|---|---|---|
| [v3.0.9-cache.md](v3.0.9-cache.md) | Internal pre-implementation analysis for v3.0.9 (filters/instant mode/mobile/guidelines) | Released as v3.0.9 (see CHANGELOG) | 2026-04-30 |
| [v3.3.1-modernization.md](v3.3.1-modernization.md) | Modernization plan after v3.3.0 audit | Released as v3.3.1 / v3.4.0 (see CHANGELOG) | 2026-04-30 |
| [refactoring-spec-v1.md](refactoring-spec-v1.md) | UX overhaul plan (Waves 1–8) before v3.4.0 | Implemented in v3.4.0 / v3.4.1 | 2026-04-30 |
| [audit-database-view-specs.md](audit-database-view-specs.md) | Cross-spec consistency audit for v3.3.0 | All issues resolved or rolled into [architecture-engine-v2.md](../architecture-engine-v2.md) | 2026-04-30 |
| [database-view-v3.4.0-spec.md](database-view-v3.4.0-spec.md) | Comprehensive vision spec for v3.4.0 | Implemented (Phases 1–6); ongoing work in [architecture-engine-v2.md](../architecture-engine-v2.md) | 2026-04-30 |

## Archive policy

A document is moved here when **all** of the following are true:

1. Its plan / spec has been delivered, cancelled, or fully superseded.
2. No active document references it as the source of truth.
3. It has historical value (decisions, gap analysis, design rationale) worth preserving.

Once archived, files in this folder are **read-only by convention**. If a fact from an archived document is still needed, copy it forward into an active document and add the original as a citation.
