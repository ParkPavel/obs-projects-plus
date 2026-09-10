# Agent workspace moved to Claudex

The development harness has become a separate public project:
[Claudex / Клаудекс](https://github.com/ParkPavel/claudex).

Claudex owns shared instructions, Claude/Codex roles, delegation, native Obsidian CLI
integration and push safety. This repository owns the plugin, its product contracts,
tests and acceptance evidence.

The local desktop contains sibling folders for Claudex and this project, plus private
storage for worktrees, temporary files and machine settings. Minimal generated agent
entrypoints live at desktop level. The old project-local agent configuration directories
are retired. Existing Git worktrees and private configuration backups are retained locally.

Future releases should link to Claudex for setup rather than reintroducing copied agent
configuration. Global provider authentication is user-owned and is not part of the public
package. See [the current development protocol](internal/TWO_MODEL_PROTOCOL.md).
