import { getWorldElement } from "@shared/data/worldElements";
import { TECHNOLOGIES } from "@shared/data/technologies";
import { getUnitDefinition } from "@shared/data/units";

export type WorldElementRequirementId = "unit" | "tech" | "city" | "cost" | "upgrade";

export interface WorldElementRequirement {
  id: WorldElementRequirementId;
  label: string;
  detail?: string;
}

export const getTechDisplayName = (techId?: string) => {
  if (!techId) return null;
  return TECHNOLOGIES[techId]?.name || techId;
};

const unitName = (unitType: string) => getUnitDefinition(unitType as any)?.name || unitType;
const unitTech = (unitType: string) => getUnitDefinition(unitType as any)?.requiredTechnology;

const unitRequirement = (elementId: string, actionType: "harvest" | "build", requiresUnitTag?: string) => {
  if (requiresUnitTag === "naval_commander") {
    const commanderTech = getTechDisplayName(unitTech("commander"));
    const detailParts = ["Commander with Naval Command"];
    if (commanderTech) detailParts.push(`Tech: ${commanderTech}`);

    return {
      id: "unit",
      label: "Naval Commander on tile",
      detail: detailParts.join(" • "),
    } satisfies WorldElementRequirement;
  }
  if (requiresUnitTag === "naval_transport") {
    const boatTech = getTechDisplayName(unitTech("boat"));
    const detailParts = ["Any naval transport unit (Boat, Voyager, etc.)"];
    if (boatTech) detailParts.push(`Tech: ${boatTech}`);

    return {
      id: "unit",
      label: "Naval transport unit on tile",
      detail: detailParts.join(" • "),
    } satisfies WorldElementRequirement;
  }

  if (actionType === "harvest" && elementId === "jaredite_ruins") {
    return { id: "unit", label: "Any unit on tile" } satisfies WorldElementRequirement;
  }

  const workerTech = getTechDisplayName(unitTech("worker"));
  return {
    id: "unit",
    label: `${unitName("worker")} on tile`,
    detail: workerTech ? `Tech: ${workerTech}` : undefined,
  } satisfies WorldElementRequirement;
};

export const getWorldElementActionRequirements = (
  elementId: string,
  actionType: "harvest" | "build",
  options?: { includeUpgrade?: boolean }
): WorldElementRequirement[] => {
  const element = getWorldElement(elementId);
  if (!element) return [];

  if (actionType === "harvest" && !element.immediateAction) return [];
  if (actionType === "build" && !element.longTermBuild) return [];

  const requirements: WorldElementRequirement[] = [];
  const requiresUnitTag = actionType === "harvest"
    ? element.immediateAction?.requiresUnitTag
    : element.longTermBuild?.requiresUnitTag;
  requirements.push(unitRequirement(elementId, actionType, requiresUnitTag));

  const techName = getTechDisplayName(element.techPrerequisite);
  if (techName) {
    requirements.push({
      id: "tech",
      label: `Tech: ${techName}`,
    });
  }

  if (actionType === "build" && element.longTermBuild) {
    requirements.push({ id: "city", label: "Owned city required" });
    if (element.longTermBuild.costStars > 0) {
      requirements.push({
        id: "cost",
        label: `Cost: ${element.longTermBuild.costStars}★`,
      });
    }

    if (options?.includeUpgrade && element.longTermBuild.upgrade) {
      const upgradeTech = getTechDisplayName(element.longTermBuild.upgrade.techRequired);
      const upgradeCost = element.longTermBuild.upgrade.costStars || 0;
      const detailParts = [];
      if (upgradeTech) detailParts.push(`Tech: ${upgradeTech}`);
      if (upgradeCost > 0) detailParts.push(`Cost: ${upgradeCost}★`);
      requirements.push({
        id: "upgrade",
        label: `Upgrade: ${element.longTermBuild.upgrade.structure}`,
        detail: detailParts.length ? detailParts.join(" • ") : undefined,
      });
    }
  }

  return requirements;
};

const formatShortRequirement = (reqs: WorldElementRequirement[]) => {
  const parts: string[] = [];
  const unit = reqs.find(req => req.id === "unit");
  if (unit) parts.push(unit.label.replace(/ on tile/i, ""));
  const tech = reqs.find(req => req.id === "tech");
  if (tech) parts.push(tech.label);
  return parts.join(" • ");
};

export const getWorldElementRequirementSummary = (elementId: string): string | null => {
  const harvestReqs = getWorldElementActionRequirements(elementId, "harvest");
  const buildReqs = getWorldElementActionRequirements(elementId, "build");
  const harvestSummary = harvestReqs.length ? formatShortRequirement(harvestReqs) : null;
  const buildSummary = buildReqs.length ? formatShortRequirement(buildReqs) : null;

  if (harvestSummary && buildSummary && harvestSummary !== buildSummary) {
    return `Immediate: ${harvestSummary} • Build: ${buildSummary}`;
  }

  return harvestSummary || buildSummary;
};

export const formatRequirementList = (reqs: WorldElementRequirement[]) =>
  reqs.map(req => (req.detail ? `${req.label} (${req.detail})` : req.label)).join(" • ");
