# Live acceptance through Obsidian CLI

The current host adapter is maintained in
[Claudex](https://github.com/ParkPavel/claudex/blob/main/docs/how-to/obsidian.md).
It uses the native Obsidian CLI, an explicit test-vault identity and local evidence capture.
Project-local REST MCP settings and the previous agent runner are retired.

## Acceptance protocol

1. Read the task's observable criteria and current product contract.
2. Run the product checks on the final source state: build, Jest, lint and svelte-check.
3. Record source revision and bundle hashes; deploy the intended build to the designated
   test vault and reload that plugin through the CLI.
4. Exercise the actual user path. Capture relevant DOM, visible state and JavaScript errors.
5. Read back the actual result. For persistence, reload and read it again. For conflicts,
   inspect preservation/recovery of both versions, not merely the existence of a notice.
6. Record PASS, FAIL or UNKNOWN per criterion with artifact references and source/build identity.

The selected vault must be verified before mutation. Screenshots prove appearance;
successful commands prove execution; neither alone proves data durability. Code-derived
flow review supplies hypotheses and cannot replace the live run.

## Historical REST procedure

The [previous runbook](archive/MANUAL_TESTING_PIPELINE_REST_2026-09-10.md) is retained only
as historical evidence. Its credentials, ports, startup assumptions and tool limitations
are superseded. Product-specific failure cases and old acceptance reports remain useful
when their source/build and date are stated.
