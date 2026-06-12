// F2.5 (#074): groupRows was un-archived — the grouping engine is pure
// logic shared by Table V2 and lives in
// src/ui/views/Dashboard/widgets/DatabaseCall/groupRows.ts.
// This shim keeps the archived V1 widget compilable (archive may import
// from src; src must never import from archive — R0_4).
export * from "src/ui/views/Dashboard/widgets/DatabaseCall/groupRows";
