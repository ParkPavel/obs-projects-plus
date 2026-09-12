# v3.4.1 — Board DnD Hotfix

**Release Date**: April 21, 2026  
**Compatibility**: Obsidian 1.5.7+

## What's Fixed

### Board column drag-and-drop
- **Shadow placeholders are filtered** out of the persisted column order, so reorder no longer leaves ghost or floating columns behind
- **Pending reorder state is flushed on destroy**, which protects the final column order when the Board view closes mid-drag
- **Rendered drag geometry is respected** for collapsed and scaled columns, improving hit testing and drop stability

### Shared DnD cleanup path
- **Active drag cleanup is forced** when the origin or shadow drop zone is destroyed during drag
- The compiled runtime bundle now matches the intended hotfix behavior even when unmount happens before normal finalize callbacks run

### Packaging and workflow
- **Runtime package contract** is now `main.js`, `manifest.json`, and `styles.css`
- **`main.css` is removed after merge** into `styles.css`, so release snapshots match what Obsidian actually loads
- **Version metadata** is updated consistently for `manifest.json`, `package.json`, and `versions.json`

## Verification
- Production build regenerated for `3.4.1`
- Release snapshot prepared in this folder