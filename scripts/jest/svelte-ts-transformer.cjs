const ts = require("typescript");
const svelte = require("svelte/compiler");

function normalizeImportLine(line) {
  const normalizedWhitespace = line.replace(/\s+/g, " ").trim();

  if (/^import\s+type\b/.test(normalizedWhitespace)) {
    return "";
  }

  const normalizedImport = normalizedWhitespace
    .replace(/\{\s*([^}]*)\s*\}/g, (_match, specifiers) => {
      const kept = specifiers
        .split(",")
        .map((specifier) => specifier.trim())
        .filter(Boolean)
        .filter((specifier) => !specifier.startsWith("type "));

      return kept.length > 0 ? `{ ${kept.join(", ")} }` : "";
    })
    .replace(/,\s*,/g, ",")
    .replace(/\{\s*,/g, "{")
    .replace(/,\s*\}/g, " }")
    .replace(/import\s+,/g, "import ")
    .replace(/,\s*from\b/g, " from")
    .replace(/\s+from/g, " from")
    .trim();

  if (/^import\s+from\b/.test(normalizedImport)) {
    return "";
  }

  return normalizedImport;
}

function transpileTypeScriptScripts(source, filename) {
  return source.replace(/<script([^>]*?)lang=["']ts["']([^>]*)>([\s\S]*?)<\/script>/g, (_match, before, after, content) => {
    const importStatements = content.match(/^\s*import[\s\S]*?;\s*$/gm) ?? [];
    const importLines = importStatements
      .map((statement) => normalizeImportLine(statement))
      .filter(Boolean);
    const body = content.replace(/^\s*import[\s\S]*?;\s*$/gm, "");

    const transpiled = ts.transpileModule(body, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2019,
      },
      fileName: filename,
    }).outputText;

    return `<script${before}${after}>${importLines.join("\n")}\n${transpiled}</script>`;
  });
}

function process(src, filename) {
  const normalizedSource = transpileTypeScriptScripts(src, filename);
  const result = svelte.compile(normalizedSource, {
    filename,
    accessors: true,
    dev: true,
    format: "cjs",
  });

  return {
    code: result.js.code,
    map: result.js.map,
  };
}

module.exports = { process };

