// Minimal mock for 'yaml' used in tests. Expose the API surface our code uses.
// We provide a simple parse function and a stringify-like function if needed.

module.exports = {
  parse: (input) => {
    // Lightweight YAML parser for the subset used in tests:
    // - top-level key: value
    // - lists with '-' under a key
    // - quoted values preserved
    // - items starting with '#' are treated as null (per tests)
    const lines = String(input || "").split(/\r?\n/);
    const result = {};
    let i = 0;
    while (i < lines.length) {
      let line = lines[i].trimRight();
      if (!line || /^---$/.test(line)) {
        i++;
        continue;
      }

      const m = line.match(/^([^:]+):\s*(.*)$/);
      if (m) {
        const key = m[1].trim();
        let rest = m[2];
        if (rest === "") {
          // collect list items
          const items = [];
          let j = i + 1;
          while (j < lines.length) {
            const li = lines[j];
            const itemMatch = li.match(/^\s*-\s*(.*)$/);
            if (!itemMatch) break;
            let item = itemMatch[1];
            if (item === "" || item.startsWith("#")) {
              items.push(null);
            } else {
              // strip surrounding quotes if present
              item = item.trim();
              if ((item.startsWith('"') && item.endsWith('"')) || (item.startsWith("'") && item.endsWith("'"))) {
                item = item.slice(1, -1);
              }
              items.push(item);
            }
            j++;
          }
          if (items.length) {
            result[key] = items;
            i = j;
            continue;
          }
          result[key] = "";
        } else {
          // single-line value
          let val = rest.trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          result[key] = val;
        }
      }
      i++;
    }
    return result;
  },
  stringify: (obj) => {
    // Minimal stringify to satisfy tests that call stringify; we emit simple YAML-like text.
    if (!obj || typeof obj !== 'object') return '';
    const lines = [];
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (Array.isArray(v)) {
        lines.push(`${k}:`);
        for (const item of v) {
          lines.push(`- ${item === null ? '' : item}`);
        }
      } else if (typeof v === 'string') {
        lines.push(`${k}: ${v}`);
      } else if (v === null) {
        lines.push(`${k}: `);
      } else {
        lines.push(`${k}: ${String(v)}`);
      }
    }
    return lines.join('\n');
  },
};
