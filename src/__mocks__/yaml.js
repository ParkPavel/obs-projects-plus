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
            result[key] = val; // Keep as string if quoted
          } else if (val === '' || val === 'null' || val === '~') {
            result[key] = null;
          } else if (val === 'true') {
            result[key] = true;
          } else if (val === 'false') {
            result[key] = false;
          } else if (/^-?\d+$/.test(val)) {
            result[key] = parseInt(val, 10);
          } else if (/^-?\d+\.\d+$/.test(val)) {
            result[key] = parseFloat(val);
          } else {
            result[key] = val;
          }
        }
      }
      i++;
    }
    return result;
  },
  stringify: (obj, options) => {
    // Minimal stringify to satisfy tests that call stringify; we emit simple YAML-like text.
    if (!obj || typeof obj !== 'object') return '';
    const lines = [];
    const defaultStringType = options && options.defaultStringType || 'PLAIN';
    
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (Array.isArray(v)) {
        lines.push(`${k}:`);
        for (const item of v) {
          lines.push(`- ${item === null ? '' : item}`);
        }
      } else if (typeof v === 'string') {
        // Check if string needs quoting based on defaultStringType and content
        let shouldQuote = false;
        if (defaultStringType === 'QUOTE_DOUBLE') {
          shouldQuote = true;
        } else if (defaultStringType === 'PLAIN') {
          shouldQuote = needsQuoting(v);
        }
        
        if (shouldQuote) {
          lines.push(`${k}: "${v}"`);
        } else {
          lines.push(`${k}: ${v}`);
        }
      } else if (v === null) {
        lines.push(`${k}:`);
      } else if (typeof v === 'object' && v.__quoted) {
        // Handle special quoted value
        lines.push(`${k}: "${v.__quoted}"`);
      } else {
        lines.push(`${k}: ${String(v)}`);
      }
    }
    return lines.join('\n') + '\n';
  },
};

/**
 * Determine if a string needs quoting based on YAML special characters
 */
function needsQuoting(str) {
  // Quote strings that look like numbers to preserve string type
  if (/^-?\d+\.?\d*$/.test(str)) {
    return true;
  }
  
  // Quote strings that look like booleans
  if (/^(true|false|yes|no|on|off)$/i.test(str)) {
    return true;
  }
  
  // Don't quote simple strings that don't need it
  if (/^[a-zA-Z][a-zA-Z0-9\-_]*$/.test(str)) {
    return false; // Don't quote simple identifiers starting with letter
  }
  
  // Quote strings that end with colon
  if (str.endsWith(':')) {
    return true;
  }
  
  // Don't quote simple key:value patterns
  if (/^[a-zA-Z0-9_]+:[a-zA-Z0-9_]*$/.test(str)) {
    return false;
  }
  
  // Don't quote dash-only strings like "Title-" or "-Title"
  if (/^[a-zA-Z]+-+$/.test(str) || /^-+[a-zA-Z]+$/.test(str)) {
    return false;
  }
  
  // Quote strings that start with dash followed by space
  if (str.startsWith('- ')) {
    return true;
  }
  
  // Quote strings that contain colons and have spaces (like "Notes: Who Needs Them?")
  if (str.includes(':') && str.includes(' ')) {
    return true;
  }
  
  // Quote strings with brackets
  if (str.includes('[') || str.includes(']')) {
    return true;
  }
  
  // Quote strings that start or end with spaces
  if (str.startsWith(' ') || str.endsWith(' ')) {
    return true;
  }
  
  // Don't quote comma-separated lists like "foo, bar, baz"
  if (/^[a-zA-Z\s,]+$/.test(str) && str.includes(',') && str.includes(' ')) {
    return false;
  }
  
  // Don't quote long strings without special characters
  if (/^-+$/.test(str)) {
    return false;
  }
  
  return false;
}
