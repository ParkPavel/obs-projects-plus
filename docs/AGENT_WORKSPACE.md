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

## Checks and publication

Run project checks through Claudex to keep logs, Jest JSON and source identity together in
private per-run artifacts. The old root `test-results.json` described an April run and is
retired from tracking. Tracked `main.js`, `styles.css` and versioned release bundles remain
intentional installation artifacts under the existing bundle policy.

Product CI checks pull requests with read-only repository permissions. It does not commit
beta metadata or push directly to `main`. Versioned release publication remains in the tag
workflow. Local publication guards are supplied by the sibling Claudex installation with
an explicit reviewed public baseline; see its product guard adoption guide. GitHub requires
the product `build` check and a pull request before integration.
