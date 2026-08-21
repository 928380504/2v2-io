import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const requiredRoutes = [
  "functions/api/health.ts",
  "functions/api/comments/index.ts",
  "functions/api/comments/ratings.ts",
  "functions/api/comments/[commentId]/reaction.ts",
  "functions/api/games/cards.ts",
  "functions/api/games/[gameId]/engagement.ts",
  "functions/api/ticker.ts",
  "functions/api/leaderboard/daily.ts",
  "functions/api/leaderboard/all-time.ts",
  "functions/api/leaderboard/context.ts",
  "functions/api/leaderboard/live.ts",
  "functions/api/matches/batch.ts",
  "functions/api/profile/[profileId].ts"
];

function relativeFiles(directory, extension) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return relativeFiles(absolute, extension);
    return entry.isFile() && entry.name.endsWith(extension)
      ? [path.relative(root, absolute).replaceAll("\\", "/")]
      : [];
  });
}

const siteManifestPath = path.join(root, "site", "competition-migrations.json");
const manifestPath = fs.existsSync(siteManifestPath)
  ? siteManifestPath
  : path.join(root, "backend", "migrations.json");
if (!fs.existsSync(manifestPath)) {
  errors.push("site/competition-migrations.json and backend/migrations.json are both missing.");
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const groups = manifest.groups || {};
  const selectedAdapterSource = fs.readFileSync(
    path.join(root, "site", "backend.ts"),
    "utf8"
  );
  const selectedAdapter = selectedAdapterSource.match(
    /competitionAdapterId:\s*["']([^"']+)["']/
  )?.[1];
  if (!groups.community) errors.push("Migration group community is missing.");
  if (!selectedAdapter || !groups[selectedAdapter]) {
    errors.push(`Migration group for selected adapter ${selectedAdapter || "unknown"} is missing.`);
  }

  const grouped = [];
  for (const [groupName, files] of Object.entries(groups)) {
    if (!Array.isArray(files) || files.length === 0) {
      errors.push(`Migration group ${groupName} must contain at least one file.`);
      continue;
    }
    let previousNumber = -1;
    for (const file of files) {
      const normalized = String(file).replaceAll("\\", "/");
      grouped.push(normalized);
      if (!fs.existsSync(path.join(root, normalized))) {
        errors.push(`Migration file is missing: ${normalized}`);
      }
      const number = Number(path.basename(normalized).match(/^(\d+)_/)?.[1]);
      if (!Number.isInteger(number)) {
        errors.push(`Migration filename must start with a number: ${normalized}`);
      } else if (number <= previousNumber) {
        errors.push(`Migration group ${groupName} is not in ascending order.`);
      }
      previousNumber = number;
    }
  }

  const sqlFiles = relativeFiles(path.join(root, "migrations"), ".sql").sort();
  const uniqueGrouped = new Set(grouped);
  for (const file of sqlFiles) {
    const occurrences = grouped.filter((item) => item === file).length;
    if (occurrences !== 1) {
      errors.push(`Migration ${file} must belong to exactly one group (found ${occurrences}).`);
    }
  }
  for (const file of uniqueGrouped) {
    if (!sqlFiles.includes(file)) errors.push(`Unknown migration in manifest: ${file}`);
  }
}

for (const route of requiredRoutes) {
  const absolute = path.join(root, route);
  if (!fs.existsSync(absolute)) {
    errors.push(`Required API compatibility route is missing: ${route}`);
    continue;
  }
  const source = fs.readFileSync(absolute, "utf8");
  if (!source.includes("backend/")) {
    errors.push(`API route must delegate to backend modules: ${route}`);
  }
  if (/\b(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*\b(FROM|INTO|SET)\b/i.test(source)) {
    errors.push(`API compatibility route contains database implementation: ${route}`);
  }
}

const backendSources = relativeFiles(path.join(root, "backend"), ".ts");
for (const file of backendSources) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  if (source.includes("_shared/")) {
    errors.push(`Backend module still imports the retired functions/_shared layer: ${file}`);
  }
}

const definition = JSON.parse(
  fs.readFileSync(path.join(root, "template", "template.json"), "utf8")
);
if (!(definition.corePaths || []).includes("backend")) {
  errors.push("template/template.json corePaths must include backend.");
}
for (const protectedPath of ["functions", "migrations", "site"]) {
  if (!(definition.protectedPaths || []).includes(protectedPath)) {
    errors.push(`template/template.json must protect ${protectedPath}.`);
  }
}

if (errors.length) {
  errors.forEach((message) => console.error(`ERROR ${message}`));
  console.error(`Backend validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `Backend validation passed: ${requiredRoutes.length} API routes, ${backendSources.length} reusable modules.`
);
