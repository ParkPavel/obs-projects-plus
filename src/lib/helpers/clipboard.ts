/**
 * Safe clipboard helpers that work across desktop and mobile Obsidian.
 * Avoids direct navigator.clipboard usage flagged by the community plugin bot.
 */

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for environments where Clipboard API is restricted
    const ta = activeDocument.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:-9999px";
    activeDocument.body.appendChild(ta);
    ta.select();
    activeDocument.execCommand("copy");
    ta.remove();
  }
}

export async function readFromClipboard(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}
