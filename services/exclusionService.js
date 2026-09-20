const path = require('path');

class ExclusionService {
  /**
   * Pre-compiles and normalizes an array of exclusion strings into matchers.
   */
  compileRules(exclusionRules) {
    if (!Array.isArray(exclusionRules)) return [];

    return exclusionRules
      .map(rule => (typeof rule === 'string' ? rule.trim() : ''))
      .filter(rule => rule.length > 0)
      .map(rule => {
        // Normalize slashes to forward slashes for cross-platform matching
        const normalized = rule.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        const isWildcard = rule.includes('*') || rule.includes('?');

        let regex = null;
        if (isWildcard) {
          // Convert wildcard pattern to regular expression
          // Escape regex special chars except * and ?
          const escaped = normalized
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
          regex = new RegExp(`^${escaped}$`, 'i');
        }

        return {
          raw: rule,
          normalized,
          lower: normalized.toLowerCase(),
          isWildcard,
          regex,
          isPath: normalized.includes('/')
        };
      });
  }

  /**
   * Checks if a file or directory should be excluded.
   * @param {string} relativePath - Relative path from the source root (e.g. "src/test/file.js" or "node_modules")
   * @param {boolean} isDir - Whether the entry is a directory
   * @param {Array<Object>|Array<string>} compiledRulesOrRaw - Compiled rule objects or raw strings
   * @returns {{ excluded: boolean, rule: string|null }}
   */
  shouldExclude(relativePath, isDir, compiledRulesOrRaw) {
    if (!compiledRulesOrRaw || compiledRulesOrRaw.length === 0) {
      return { excluded: false, rule: null };
    }

    const rules = Array.isArray(compiledRulesOrRaw) && compiledRulesOrRaw[0]?.lower !== undefined
      ? compiledRulesOrRaw
      : this.compileRules(compiledRulesOrRaw);

    const normRelPath = relativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const normLower = normRelPath.toLowerCase();
    const basename = path.posix.basename(normRelPath);
    const baseLower = basename.toLowerCase();
    const segments = normLower.split('/');

    for (const rule of rules) {
      // 1. Direct basename match (e.g. "node_modules", ".env", "Thumbs.db")
      if (!rule.isPath && !rule.isWildcard) {
        if (baseLower === rule.lower) {
          return { excluded: true, rule: rule.raw };
        }
        // If any ancestor folder matches the exact rule name (e.g. inside "node_modules")
        if (segments.includes(rule.lower)) {
          return { excluded: true, rule: rule.raw };
        }
      }

      // 2. Relative path match (e.g. "src/test", "build/temp")
      if (rule.isPath && !rule.isWildcard) {
        if (normLower === rule.lower) {
          return { excluded: true, rule: rule.raw };
        }
        // If the path starts with the rule directory (e.g., "src/test/sub/file.js" starts with "src/test/")
        if (normLower.startsWith(rule.lower + '/')) {
          return { excluded: true, rule: rule.raw };
        }
      }

      // 3. Wildcard matching (e.g. "*.log", "*.tmp", "test-*.json", "build/*/cache")
      if (rule.isWildcard && rule.regex) {
        // Test on basename (e.g. "*.log" against "app.log")
        if (rule.regex.test(basename)) {
          return { excluded: true, rule: rule.raw };
        }
        // Test on full relative path
        if (rule.regex.test(normRelPath)) {
          return { excluded: true, rule: rule.raw };
        }
        // Test on any folder segment
        if (segments.some(seg => rule.regex.test(seg))) {
          return { excluded: true, rule: rule.raw };
        }
      }
    }

    return { excluded: false, rule: null };
  }
}

module.exports = new ExclusionService();
