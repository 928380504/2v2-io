import fs from "node:fs";
import path from "node:path";
import { hashFile, resolveInside, writeJson } from "./template-tools.mjs";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function requiredText(value, label, maximum = 128) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`${label} must contain 1-${maximum} characters.`);
  }
  return normalized;
}

function validateSlug(value, label) {
  const normalized = requiredText(value, label, 64);
  if (!SLUG.test(normalized)) {
    throw new Error(`${label} must use lowercase letters, numbers and single hyphens.`);
  }
  return normalized;
}

function validateCompetition(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  for (const key of [
    "mode",
    "metricField",
    "previousPeriodMetricField",
    "metricLabel",
    "metricSingular",
    "metricPlural",
    "previousPeriodLabel",
    "previousPodiumPlaceholder",
  ]) {
    requiredText(value[key], `${label}.${key}`, 160);
  }
  if (!IDENTIFIER.test(value.metricField) || !IDENTIFIER.test(value.previousPeriodMetricField)) {
    throw new Error(`${label} metric fields must be JavaScript identifiers.`);
  }
  const activity = value.activity;
  if (!activity || typeof activity !== "object" || Array.isArray(activity)) {
    throw new Error(`${label}.activity must be an object.`);
  }
  for (const key of [
    "resultType",
    "streakType",
    "rankingType",
    "resultBadge",
    "streakBadge",
    "rankingBadge",
    "waitingText",
    "resultVerb",
    "defaultOpponent",
    "defaultModeLabel",
    "streakNoun",
    "streakFallbackLabel",
    "rankingFallbackLabel",
    "revengeAchievementKey",
    "revengeText",
  ]) {
    if (typeof activity[key] !== "string" || activity[key].length > 200) {
      throw new Error(`${label}.activity.${key} must be a string up to 200 characters.`);
    }
  }
}

export function readCompetitionPack(packRoot) {
  const packPath = path.join(packRoot, "pack.json");
  if (!fs.existsSync(packPath)) throw new Error(`Competition pack is missing pack.json: ${packRoot}`);
  const pack = readJson(packPath);
  if (pack.schemaVersion !== 1) throw new Error(`${packPath} must use schemaVersion 1.`);
  const id = validateSlug(pack.id, "pack.id");
  const adapterId = validateSlug(pack.adapterId, "pack.adapterId");
  if (id !== adapterId) throw new Error("pack.id and pack.adapterId must match.");
  validateCompetition(pack.competition, "pack.competition");
  let migration = null;
  if (pack.migration !== null) {
    if (!pack.migration || typeof pack.migration !== "object") {
      throw new Error("pack.migration must be null or an object.");
    }
    const source = requiredText(pack.migration.source, "pack.migration.source", 128);
    const targetStem = validateSlug(pack.migration.targetStem.replaceAll("_", "-"), "pack.migration.targetStem")
      .replaceAll("-", "_");
    const sourcePath = resolveInside(packRoot, source);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      throw new Error(`Competition migration source is missing: ${source}`);
    }
    migration = { source, sourcePath, targetStem };
  }
  return {
    ...pack,
    id,
    adapterId,
    displayName: requiredText(pack.displayName, "pack.displayName", 120),
    gameId: validateSlug(pack.gameId, "pack.gameId"),
    modeKey: validateSlug(pack.modeKey, "pack.modeKey"),
    eventSchemaVersion: Number(pack.eventSchemaVersion),
    migration,
    packRoot,
    packPath,
  };
}

export function listCompetitionPacks(root) {
  const packsRoot = path.join(root, "competition-packs");
  if (!fs.existsSync(packsRoot)) return [];
  return fs.readdirSync(packsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readCompetitionPack(path.join(packsRoot, entry.name)))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function migrationManifestPath(root) {
  const sitePath = path.join(root, "site", "competition-migrations.json");
  return fs.existsSync(sitePath)
    ? sitePath
    : path.join(root, "backend", "migrations.json");
}

export function readMigrationManifest(root) {
  const sourcePath = migrationManifestPath(root);
  if (!fs.existsSync(sourcePath)) {
    throw new Error("No site/competition-migrations.json or backend/migrations.json exists.");
  }
  const value = readJson(sourcePath);
  if (value.schemaVersion !== 1 || !value.groups || typeof value.groups !== "object") {
    throw new Error(`${path.relative(root, sourcePath)} must contain schemaVersion 1 and groups.`);
  }
  return { sourcePath, value };
}

function migrationFiles(root) {
  const directory = path.join(root, "migrations");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/i.test(entry.name))
    .map((entry) => ({
      name: entry.name,
      number: Number(entry.name.match(/^(\d+)_/)?.[1]),
      relativePath: `migrations/${entry.name}`,
      absolutePath: path.join(directory, entry.name),
    }))
    .sort((left, right) => left.number - right.number);
}

function nextMigrationPath(root, stem) {
  const files = migrationFiles(root);
  const nextNumber = Math.max(0, ...files.map((file) => file.number)) + 1;
  return `migrations/${String(nextNumber).padStart(4, "0")}_${stem}.sql`;
}

function serializeTypeScript(value, depth = 1) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeTypeScript(item, depth + 1)).join(", ")}]`;
  }
  const indentation = "  ".repeat(depth);
  const closingIndentation = "  ".repeat(Math.max(0, depth - 1));
  const entries = Object.entries(value).map(([key, item]) => {
    const property = IDENTIFIER.test(key) ? key : JSON.stringify(key);
    return `${indentation}${property}: ${serializeTypeScript(item, depth + 1)},`;
  });
  return `{\n${entries.join("\n")}\n${closingIndentation}}`;
}

function objectPropertyRange(source, propertyName) {
  const propertyPattern = new RegExp(`(^|\\n)([ \\t]*)${propertyName}\\s*:\\s*\\{`, "m");
  const match = propertyPattern.exec(source);
  if (!match) throw new Error(`Could not find ${propertyName}: { ... } in site/data-provider.ts.`);
  const propertyStart = match.index + match[1].length;
  const openingBrace = source.indexOf("{", propertyStart);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openingBrace; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        if (source[end] === ",") end += 1;
        return { start: propertyStart, end, indentation: match[2] };
      }
    }
  }
  throw new Error(`Unclosed ${propertyName} object in site/data-provider.ts.`);
}

export function replaceCompetitionProvider(source, competition) {
  const range = objectPropertyRange(source, "competition");
  const serialized = serializeTypeScript(competition, 2);
  const replacement = `${range.indentation}competition: ${serialized},`;
  return `${source.slice(0, range.start)}${replacement}${source.slice(range.end)}`;
}

export function replaceSelectedAdapter(source, adapterId) {
  const pattern = /(competitionAdapterId:\s*)["'][^"']+["']/;
  if (!pattern.test(source)) {
    throw new Error("site/backend.ts does not declare competitionAdapterId.");
  }
  return source.replace(pattern, `$1${JSON.stringify(adapterId)}`);
}

function selectedAdapter(source) {
  return source.match(/competitionAdapterId:\s*["']([^"']+)["']/)?.[1] || null;
}

function ensureBuiltInAdapter(root, adapterId) {
  const contracts = fs.readFileSync(path.join(root, "backend", "contracts.ts"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "backend", "runtime.ts"), "utf8");
  const blockers = [];
  if (!contracts.includes(JSON.stringify(adapterId))) {
    blockers.push(`Template core does not declare CompetitionAdapterId ${adapterId}.`);
  }
  if (!runtime.includes(`${JSON.stringify(adapterId)}:`)) {
    blockers.push(`Template core does not register competition adapter ${adapterId}.`);
  }
  return blockers;
}

export function buildCompetitionInstallAudit({ root, pack }) {
  const backendPath = path.join(root, "site", "backend.ts");
  const providerPath = path.join(root, "site", "data-provider.ts");
  const required = [backendPath, providerPath, path.join(root, "migrations")];
  const blockers = required
    .filter((target) => !fs.existsSync(target))
    .map((target) => `Missing required target: ${path.relative(root, target)}`);
  blockers.push(...ensureBuiltInAdapter(root, pack.adapterId));
  if (blockers.length) {
    return { status: "blocked", blockers, pack, changes: [], additions: [], updates: [] };
  }

  const backendSource = fs.readFileSync(backendPath, "utf8");
  const providerSource = fs.readFileSync(providerPath, "utf8");
  const nextBackend = replaceSelectedAdapter(backendSource, pack.adapterId);
  const nextProvider = replaceCompetitionProvider(providerSource, pack.competition);
  const { sourcePath: oldManifestPath, value: oldManifest } = readMigrationManifest(root);
  const siteManifestPath = path.join(root, "site", "competition-migrations.json");
  const nextManifest = structuredClone(oldManifest);
  let targetMigrationPath = null;
  let migrationAction = "none";
  const existingGroup = nextManifest.groups[pack.id];

  if (pack.migration) {
    if (Array.isArray(existingGroup) && existingGroup.length) {
      targetMigrationPath = String(existingGroup[0]).replaceAll("\\", "/");
      const targetPath = path.join(root, ...targetMigrationPath.split("/"));
      if (!fs.existsSync(targetPath)) {
        blockers.push(`Installed migration group points to a missing file: ${targetMigrationPath}`);
      } else if (hashFile(targetPath) !== hashFile(pack.migration.sourcePath)) {
        blockers.push(`Installed migration differs from immutable pack source: ${targetMigrationPath}`);
      }
    } else {
      const orphan = migrationFiles(root).find((file) =>
        file.name.toLowerCase().endsWith(`_${pack.migration.targetStem}.sql`),
      );
      if (orphan) {
        blockers.push(`Unregistered migration already exists and needs review: ${orphan.relativePath}`);
      } else {
        targetMigrationPath = nextMigrationPath(root, pack.migration.targetStem);
        nextManifest.groups[pack.id] = [targetMigrationPath];
        migrationAction = "add";
      }
    }
  } else if (!Array.isArray(existingGroup) || !existingGroup.length) {
    blockers.push(`Adapter ${pack.id} has no migration pack and no installed migration group.`);
  }

  const writes = new Map();
  writes.set(backendPath, nextBackend);
  writes.set(providerPath, nextProvider);
  writes.set(siteManifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
  if (migrationAction === "add") {
    writes.set(
      path.join(root, ...targetMigrationPath.split("/")),
      fs.readFileSync(pack.migration.sourcePath),
    );
  }

  const changes = [];
  const additions = [];
  const updates = [];
  for (const [filePath, contents] of writes) {
    const exists = fs.existsSync(filePath);
    const current = exists ? fs.readFileSync(filePath) : null;
    const next = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
    const unchanged = current && (
      Buffer.isBuffer(contents)
        ? current.equals(next)
        : current.toString("utf8").replaceAll("\r\n", "\n").trimEnd() ===
          String(contents).replaceAll("\r\n", "\n").trimEnd()
    );
    if (unchanged) continue;
    const relativePath = path.relative(root, filePath).replaceAll("\\", "/");
    changes.push(relativePath);
    (exists ? updates : additions).push(relativePath);
  }

  return {
    status: blockers.length ? "blocked" : changes.length ? "ready" : "current",
    blockers,
    pack,
    currentAdapterId: selectedAdapter(backendSource),
    targetAdapterId: pack.adapterId,
    migrationAction,
    targetMigrationPath,
    oldManifestPath,
    siteManifestPath,
    writes,
    changes,
    additions,
    updates,
  };
}

export function applyCompetitionInstall({ root, audit, backupRoot, validate }) {
  if (audit.status !== "ready") {
    throw new Error(`Competition install cannot apply while status is ${audit.status}.`);
  }
  const backupFiles = [];
  for (const relativePath of audit.updates) {
    const source = resolveInside(root, relativePath);
    const backup = resolveInside(backupRoot, relativePath);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(source, backup);
    backupFiles.push(relativePath);
  }
  const writtenAdditions = [];
  try {
    for (const [filePath, contents] of audit.writes) {
      const relativePath = path.relative(root, filePath).replaceAll("\\", "/");
      if (!audit.changes.includes(relativePath)) continue;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, contents);
      if (audit.additions.includes(relativePath)) writtenAdditions.push(relativePath);
    }
    validate();
  } catch (error) {
    for (const relativePath of writtenAdditions) {
      const target = resolveInside(root, relativePath);
      if (fs.existsSync(target) && fs.statSync(target).isFile()) fs.unlinkSync(target);
    }
    for (const relativePath of backupFiles) {
      const backup = resolveInside(backupRoot, relativePath);
      const target = resolveInside(root, relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(backup, target);
    }
    throw error;
  }
}
