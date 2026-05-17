import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function listSourceFiles(path: string): string[] {
  const absolute = join(repoRoot, path);
  return readdirSync(absolute).flatMap((entry) => {
    const child = join(absolute, entry);
    const rel = relative(repoRoot, child);
    if (statSync(child).isDirectory()) return listSourceFiles(rel);
    return /\.(ts|tsx)$/.test(entry) ? [rel] : [];
  });
}

const directRuleImportPattern =
  /from\s+["'](?<module>(?:@shared\/logic|(?:\.\.\/)+logic|(?:\.\.\/)+shared\/logic)\/(?<name>constructionValidation|worldElementActions|factionAbilityAvailability|actionAvailability|unitLogic|combatResolver|technologyHelpers|conversion|abilitySystem|unitActions|combatSystem))["']/g;

const approvedLegacyRuleImports = new Set<string>();
const MAX_APPROVED_LEGACY_RULE_IMPORTS = 0;

describe("canonical shared rules drift canaries", () => {
  it("keeps resolveAction and rule queries on the same actor and ownership precondition gate", () => {
    expect(read("shared/logic/resolveAction.ts")).toContain("passesCanonicalActionPreconditions");
    expect(read("shared/logic/ruleQueries.ts")).toContain("checkCanonicalActionPreconditions");
  });

  it("keeps the client unit availability adapter as a formatter over shared rule queries", () => {
    const helper = read("client/src/lib/helpers/actionAvailabilityHelpers.ts");

    expect(helper).toContain("@shared/logic/ruleQueries");
    expect(helper).not.toContain("@shared/logic/actionAvailability");
  });

  it("keeps AI execution gated by shared legality before reducer mutation", () => {
    const manager = read("shared/ai/aiTurnManager.ts");
    const explainIndex = manager.indexOf("explainAction(this.gameState, action");
    const mutateIndex = manager.indexOf("resolveActionState(this.gameState, action");

    expect(explainIndex).toBeGreaterThan(-1);
    expect(mutateIndex).toBeGreaterThan(-1);
    expect(explainIndex).toBeLessThan(mutateIndex);
  });

  it("does not import deprecated legacy rule modules into client or AI surfaces", () => {
    const surfaces = [
      "client/src/lib/helpers/actionAvailabilityHelpers.ts",
      "client/src/selectors/city.ts",
      "client/src/selectors/tech.ts",
      "client/src/selectors/combat.ts",
      "shared/ai/aiTurnManager.ts",
    ];

    for (const surface of surfaces) {
      const content = read(surface);
      expect(content).not.toMatch(/logic\/(abilitySystem|unitActions|combatSystem)/);
    }
  });

  it("keeps new client and AI rule imports behind shared rule queries or the documented legacy allowlist", () => {
    const scannedFiles = [
      ...listSourceFiles("client/src/components"),
      ...listSourceFiles("client/src/lib"),
      ...listSourceFiles("client/src/lib/stores"),
      ...listSourceFiles("client/src/selectors"),
      ...listSourceFiles("shared/ai"),
    ];
    const unexpected: string[] = [];

    for (const file of scannedFiles) {
      const content = read(file);
      for (const match of content.matchAll(directRuleImportPattern)) {
        const modulePath = match.groups?.module;
        if (!modulePath || modulePath.endsWith("/ruleQueries")) continue;
        const key = `${file} -> ${modulePath}`;
        if (!approvedLegacyRuleImports.has(key)) unexpected.push(key);
      }
    }

    expect(unexpected).toEqual([]);
    expect(approvedLegacyRuleImports.size).toBeLessThanOrEqual(MAX_APPROVED_LEGACY_RULE_IMPORTS);
  });
});
