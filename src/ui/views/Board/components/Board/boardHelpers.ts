export function getDisplayName(recordId: string): string {
  const basename = getBasename(recordId);
  return basename.slice(0, basename.lastIndexOf("."));
}

/**
 * Extract display text from Obsidian wiki link format [[path|display]] or [[path]]
 * Also handles markdown links [display](path) and plain text
 * @param text - Text that may contain wiki/markdown links
 * @returns Clean display text without link syntax
 */
export function cleanWikiLink(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  const trimmed = text.trim();
  
  // Wiki link with display text: [[path|display]] → display
  const wikiWithDisplay = /^\[\[([^\]|]+)\|([^\]]+)\]\]$/;
  const wikiMatch = trimmed.match(wikiWithDisplay);
  if (wikiMatch && wikiMatch[2]) {
    return wikiMatch[2].trim();
  }
  
  // Wiki link without display: [[path]] → extract filename
  const wikiSimple = /^\[\[([^\]]+)\]\]$/;
  const simpleMatch = trimmed.match(wikiSimple);
  if (simpleMatch && simpleMatch[1]) {
    const path = simpleMatch[1];
    const basename = getBasename(path);
    // Remove .md extension if present
    return basename.replace(/\.md$/i, '').trim();
  }
  
  // Markdown link: [display](path) → display
  const mdLink = /^\[([^\]]+)\]\([^)]+\)$/;
  const mdMatch = trimmed.match(mdLink);
  if (mdMatch && mdMatch[1]) {
    return mdMatch[1].trim();
  }
  
  // No link formatting, return as-is
  return trimmed;
}

// This exists in the `path` Node.js package, but reimplementing for mobile support.
function getBasename(str: string) {
  const lastSlash = str.lastIndexOf("/");

  if (lastSlash < 0) {
    return str;
  }

  return str.slice(lastSlash + 1);
}
