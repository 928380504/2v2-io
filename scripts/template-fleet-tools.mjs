import fs from "node:fs";
import path from "node:path";

const SITE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeFleetConfiguration(configuration, configurationPath) {
  if (!configuration || configuration.schemaVersion !== 1) {
    throw new Error("Template fleet configuration must use schemaVersion 1.");
  }
  if (!Array.isArray(configuration.sites)) {
    throw new Error("Template fleet configuration must contain a sites array.");
  }

  const configurationDirectory = path.dirname(path.resolve(configurationPath));
  const ids = new Set();
  const paths = new Set();
  return configuration.sites.map((site, index) => {
    const label = `sites[${index}]`;
    const id = String(site?.id || "").trim().toLowerCase();
    if (!SITE_ID.test(id)) throw new Error(`${label}.id must be a lowercase slug.`);
    if (ids.has(id)) throw new Error(`Duplicate fleet site ID: ${id}.`);
    ids.add(id);

    const rawPath = String(site?.path || "").trim();
    if (!rawPath) throw new Error(`${label}.path is required.`);
    const targetPath = path.resolve(configurationDirectory, rawPath);
    const normalizedPath = targetPath.toLowerCase();
    if (paths.has(normalizedPath)) throw new Error(`Duplicate fleet site path: ${targetPath}.`);
    paths.add(normalizedPath);

    if (site.enabled !== undefined && typeof site.enabled !== "boolean") {
      throw new Error(`${label}.enabled must be boolean when provided.`);
    }
    return {
      id,
      name: String(site.name || id).trim(),
      path: targetPath,
      enabled: site.enabled !== false,
    };
  });
}

function count(output, label) {
  const match = output.match(new RegExp(`^${label}:\\s*(\\d+)`, "mi"));
  return match ? Number(match[1]) : 0;
}

export function parseSyncOutput(output, { apply = false, adopt = false, success = true } = {}) {
  const text = String(output || "");
  const versionMatch = text.match(/^Template update\s+(.+?)\s+->\s+(.+)$/mi);
  const changes = {
    add: count(text, "Add"),
    update: count(text, "Update"),
    remove: count(text, "Remove"),
    conflicts: count(text, "Local conflicts"),
    preserved: count(text, "Preserved local"),
    unchanged: count(text, "Unchanged"),
  };
  const changeCount = changes.add + changes.update + changes.remove;
  let status = "failed";
  if (success) {
    if (adopt) status = apply ? "adopted" : "adopt-ready";
    else if (apply) status = "applied";
    else if (changes.conflicts > 0) status = "conflict";
    else status = changeCount > 0 ? "ready" : "current";
  }
  return {
    status,
    fromVersion: versionMatch?.[1]?.trim() || null,
    toVersion: versionMatch?.[2]?.trim() || null,
    changes,
  };
}

export function validateTargetDirectory(targetPath) {
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) {
    return `Target directory does not exist: ${targetPath}`;
  }
  const missing = ["package.json", "site/manifest.json"].filter(
    (relativePath) => !fs.existsSync(path.join(targetPath, relativePath)),
  );
  return missing.length
    ? `Target is not an initialized game-template site; missing ${missing.join(", ")}.`
    : null;
}

export function fleetTotals(results) {
  return results.reduce(
    (totals, result) => {
      totals[result.status] = (totals[result.status] || 0) + 1;
      totals.add += result.changes?.add || 0;
      totals.update += result.changes?.update || 0;
      totals.remove += result.changes?.remove || 0;
      totals.conflicts += result.changes?.conflicts || 0;
      totals.preserved += result.changes?.preserved || 0;
      return totals;
    },
    { add: 0, update: 0, remove: 0, conflicts: 0, preserved: 0 },
  );
}
