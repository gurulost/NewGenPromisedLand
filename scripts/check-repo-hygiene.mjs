import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const baselinePath = path.join(repoRoot, "scripts", "repo-hygiene-baseline.json");
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", "output"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const TYPE_EXTENSIONS = new Set([".ts", ".tsx"]);
const MAX_SUMMARY_ITEMS = 10;

const toRepoPath = (filePath) => path.relative(repoRoot, filePath).split(path.sep).join("/");

const isTestFile = (repoPath) => {
  const parts = repoPath.split("/");
  return parts.includes("test") || parts.includes("__tests__") || /\.(test|spec)\.[cm]?[jt]sx?$/.test(repoPath);
};

const stripCommentsAndStrings = (text) => {
  let output = "";
  let index = 0;
  let state = "code";

  while (index < text.length) {
    const current = text[index];
    const next = text[index + 1];

    if (state === "code") {
      if (current === "/" && next === "/") {
        output += "  ";
        index += 2;
        state = "lineComment";
        continue;
      }
      if (current === "/" && next === "*") {
        output += "  ";
        index += 2;
        state = "blockComment";
        continue;
      }
      if (current === "'") {
        output += " ";
        index += 1;
        state = "singleQuote";
        continue;
      }
      if (current === "\"") {
        output += " ";
        index += 1;
        state = "doubleQuote";
        continue;
      }
      if (current === "`") {
        output += " ";
        index += 1;
        state = "template";
        continue;
      }
      output += current;
      index += 1;
      continue;
    }

    if (state === "lineComment") {
      output += current === "\n" ? "\n" : " ";
      index += 1;
      if (current === "\n") state = "code";
      continue;
    }

    if (state === "blockComment") {
      if (current === "*" && next === "/") {
        output += "  ";
        index += 2;
        state = "code";
      } else {
        output += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    if (state === "singleQuote") {
      if (current === "\\") {
        output += "  ";
        index += 2;
      } else if (current === "'") {
        output += " ";
        index += 1;
        state = "code";
      } else {
        output += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    if (state === "doubleQuote") {
      if (current === "\\") {
        output += "  ";
        index += 2;
      } else if (current === "\"") {
        output += " ";
        index += 1;
        state = "code";
      } else {
        output += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    if (state === "template") {
      if (current === "\\") {
        output += "  ";
        index += 2;
      } else if (current === "`") {
        output += " ";
        index += 1;
        state = "code";
      } else {
        output += current === "\n" ? "\n" : " ";
        index += 1;
      }
    }
  }

  return output;
};

const countExplicitAny = (text) => {
  const matches = stripCommentsAndStrings(text).match(/\bany\b/g);
  return matches ? matches.length : 0;
};

const walkFiles = (dirPath, visitFile) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, visitFile);
      continue;
    }

    if (entry.isFile()) visitFile(fullPath);
  }
};

const duplicateCopies = [];
const largeFiles = [];
const explicitAnyCounts = [];

walkFiles(repoRoot, (fullPath) => {
  const repoPath = toRepoPath(fullPath);
  const extension = path.extname(repoPath);
  const duplicateMatch = repoPath.match(/^(.*) (\d+)(\.[^/.]+)$/);

  if (duplicateMatch) {
    const [, stem, copyNumber, suffix] = duplicateMatch;
    if (Number(copyNumber) > 1) {
      const canonicalRepoPath = `${stem}${suffix}`;
      if (fs.existsSync(path.join(repoRoot, canonicalRepoPath))) {
        duplicateCopies.push({ duplicate: repoPath, canonical: canonicalRepoPath });
      }
    }
  }

  if (!SOURCE_EXTENSIONS.has(extension)) return;
  if (repoPath.includes(" 2.")) return;
  if (repoPath.startsWith("client/src/legacy/")) return;
  if (isTestFile(repoPath)) return;

  const text = fs.readFileSync(fullPath, "utf8");
  const lineCount = text.split(/\r?\n/).length;

  if (lineCount > baseline.largeFileLineLimit) {
    largeFiles.push({ path: repoPath, lines: lineCount });
  }

  if (!TYPE_EXTENSIONS.has(extension) || repoPath.endsWith(".d.ts")) return;

  const explicitAnyCount = countExplicitAny(text);
  if (explicitAnyCount > 0) {
    explicitAnyCounts.push({ path: repoPath, count: explicitAnyCount });
  }
});

duplicateCopies.sort((left, right) => left.duplicate.localeCompare(right.duplicate));
largeFiles.sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path));
explicitAnyCounts.sort((left, right) => right.count - left.count || left.path.localeCompare(right.path));

const currentLargeFiles = new Map(largeFiles.map((entry) => [entry.path, entry.lines]));
const currentExplicitAny = new Map(explicitAnyCounts.map((entry) => [entry.path, entry.count]));
const totalExplicitAny = explicitAnyCounts.reduce((sum, entry) => sum + entry.count, 0);

const largeFileViolations = largeFiles.filter((entry) => {
  const allowedLines = baseline.allowedLargeFiles[entry.path];
  return allowedLines === undefined || entry.lines > allowedLines;
});

const explicitAnyViolations = explicitAnyCounts.filter((entry) => {
  const allowedCount = baseline.explicitAny.files[entry.path] ?? 0;
  return entry.count > allowedCount;
});

const totalExplicitAnyViolation = totalExplicitAny > baseline.explicitAny.total;

console.log("Repo hygiene summary");
console.log(`- Duplicate numbered copies: ${duplicateCopies.length}`);
console.log(`- Oversized source files over ${baseline.largeFileLineLimit} lines: ${largeFiles.length}`);
console.log(`- Explicit any occurrences: ${totalExplicitAny}`);

const printTopList = (title, entries, formatter) => {
  if (entries.length === 0) return;
  console.log(title);
  for (const entry of entries.slice(0, MAX_SUMMARY_ITEMS)) {
    console.log(`  - ${formatter(entry)}`);
  }
};

const hasViolation = duplicateCopies.length > 0 || largeFileViolations.length > 0 || explicitAnyViolations.length > 0 || totalExplicitAnyViolation;

if (hasViolation) {
  console.error("\nRepo hygiene regressions detected:");

  if (duplicateCopies.length > 0) {
    console.error("Duplicate numbered copies:");
    for (const entry of duplicateCopies) {
      console.error(`  - ${entry.duplicate} (canonical: ${entry.canonical})`);
    }
  }

  if (largeFileViolations.length > 0) {
    console.error(`Oversized source files above the tracked ${baseline.largeFileLineLimit}-line baseline:`);
    for (const entry of largeFileViolations) {
      const allowed = baseline.allowedLargeFiles[entry.path];
      const reason = allowed === undefined ? "new oversized file" : `baseline ${allowed} lines`;
      console.error(`  - ${entry.path}: ${entry.lines} lines (${reason})`);
    }
  }

  if (explicitAnyViolations.length > 0) {
    console.error("Files that exceeded their explicit-any budget:");
    for (const entry of explicitAnyViolations) {
      const allowed = baseline.explicitAny.files[entry.path] ?? 0;
      console.error(`  - ${entry.path}: ${entry.count} > ${allowed}`);
    }
  }

  if (totalExplicitAnyViolation) {
    console.error(`Total explicit-any budget exceeded: ${totalExplicitAny} > ${baseline.explicitAny.total}`);
  }

  process.exitCode = 1;
} else {
  console.log("\nNo regressions against the tracked hygiene baseline.");
}

printTopList(
  "\nTracked large-file debt:",
  [...currentLargeFiles.entries()].sort((left, right) => right[1] - left[1]).map(([filePath, lines]) => ({ path: filePath, lines })),
  (entry) => `${entry.path} (${entry.lines} lines; baseline ${baseline.allowedLargeFiles[entry.path]})`,
);

printTopList(
  "\nTop explicit-any hotspots:",
  [...currentExplicitAny.entries()].sort((left, right) => right[1] - left[1]).map(([filePath, count]) => ({ path: filePath, count })),
  (entry) => `${entry.path} (${entry.count}; baseline ${baseline.explicitAny.files[entry.path]})`,
);
