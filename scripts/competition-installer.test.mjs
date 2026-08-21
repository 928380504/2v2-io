import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  applyCompetitionInstall,
  buildCompetitionInstallAudit,
  listCompetitionPacks,
} from "./competition-installer-tools.mjs";

const templateRoot = process.cwd();
const wordScorePack = listCompetitionPacks(templateRoot).find(
  (pack) => pack.id === "word-score",
);

function write(root, relativePath, value) {
  const target = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "competition-installer-"));
  write(
    root,
    "backend/contracts.ts",
    'export type CompetitionAdapterId = "1v1-lol" | "word-score";\n',
  );
  write(
    root,
    "backend/runtime.ts",
    'const competitionAdapters = { "1v1-lol": one, "word-score": word };\n',
  );
  write(
    root,
    "backend/migrations.json",
    JSON.stringify({
      schemaVersion: 1,
      groups: {
        community: ["migrations/0001_community.sql"],
        "1v1-lol": ["migrations/0002_matches.sql"],
      },
    }, null, 2),
  );
  write(root, "migrations/0001_community.sql", "CREATE TABLE community (id TEXT);\n");
  write(root, "migrations/0002_matches.sql", "CREATE TABLE matches (id TEXT);\n");
  write(
    root,
    "site/backend.ts",
    'export const siteBackendConfig = { databaseBinding: "DB", competitionAdapterId: "1v1-lol" };\n',
  );
  write(
    root,
    "site/data-provider.ts",
    `export const DATA_PROVIDER = {
  apiBasePath: "",
  competition: {
    mode: "1v1",
    metricField: "wins",
    previousPeriodMetricField: "previousDayWins",
    metricLabel: "WINS",
    metricSingular: "win",
    metricPlural: "wins",
    previousPeriodLabel: "yesterday",
    previousPodiumPlaceholder: "Yesterday",
    activity: {
      resultType: "live",
      streakType: "streak",
      rankingType: "arena",
      resultBadge: "LIVE",
      streakBadge: "STREAK",
      rankingBadge: "ARENA",
      waitingText: "Waiting",
      resultVerb: "defeated",
      defaultOpponent: "opponent",
      defaultModeLabel: "1v1",
      streakNoun: "wins",
      streakFallbackLabel: "Streak",
      rankingFallbackLabel: "Rank",
      revengeAchievementKey: "revenge",
      revengeText: "revenge",
    },
  },
};
`,
  );
  return root;
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test("discovers the built-in 1v1 and word-score packs", () => {
  const ids = listCompetitionPacks(templateRoot).map((pack) => pack.id);
  assert.deepEqual(ids, ["1v1-lol", "word-score"]);
  assert.equal(wordScorePack.competition.metricField, "bestScore");
});

test("previews a protected migration and site-only configuration changes", () => {
  const root = fixture();
  try {
    const audit = buildCompetitionInstallAudit({ root, pack: wordScorePack });
    assert.equal(audit.status, "ready");
    assert.equal(audit.currentAdapterId, "1v1-lol");
    assert.equal(audit.targetMigrationPath, "migrations/0003_word_score.sql");
    assert.deepEqual(audit.additions.sort(), [
      "migrations/0003_word_score.sql",
      "site/competition-migrations.json",
    ]);
    assert.ok(audit.updates.includes("site/backend.ts"));
    assert.ok(audit.updates.includes("site/data-provider.ts"));
  } finally {
    cleanup(root);
  }
});

test("applies once and becomes idempotent", () => {
  const root = fixture();
  try {
    const audit = buildCompetitionInstallAudit({ root, pack: wordScorePack });
    applyCompetitionInstall({
      root,
      audit,
      backupRoot: path.join(root, "backups", "install"),
      validate() {
        assert.match(
          fs.readFileSync(path.join(root, "site", "backend.ts"), "utf8"),
          /competitionAdapterId:\s*"word-score"/,
        );
      },
    });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "site", "competition-migrations.json"), "utf8"),
    );
    assert.deepEqual(manifest.groups["word-score"], ["migrations/0003_word_score.sql"]);
    assert.ok(fs.existsSync(path.join(root, "migrations", "0003_word_score.sql")));
    assert.match(
      fs.readFileSync(path.join(root, "site", "data-provider.ts"), "utf8"),
      /metricField:\s*"bestScore"/,
    );
    const secondAudit = buildCompetitionInstallAudit({ root, pack: wordScorePack });
    assert.equal(secondAudit.status, "current");
    assert.equal(secondAudit.changes.length, 0);
  } finally {
    cleanup(root);
  }
});

test("restores updates and removes additions when validation fails", () => {
  const root = fixture();
  try {
    const originalBackend = fs.readFileSync(path.join(root, "site", "backend.ts"), "utf8");
    const originalProvider = fs.readFileSync(
      path.join(root, "site", "data-provider.ts"),
      "utf8",
    );
    const audit = buildCompetitionInstallAudit({ root, pack: wordScorePack });
    assert.throws(() => applyCompetitionInstall({
      root,
      audit,
      backupRoot: path.join(root, "backups", "rollback"),
      validate() {
        throw new Error("forced validation failure");
      },
    }), /forced validation failure/);
    assert.equal(
      fs.readFileSync(path.join(root, "site", "backend.ts"), "utf8"),
      originalBackend,
    );
    assert.equal(
      fs.readFileSync(path.join(root, "site", "data-provider.ts"), "utf8"),
      originalProvider,
    );
    assert.equal(fs.existsSync(path.join(root, "site", "competition-migrations.json")), false);
    assert.equal(fs.existsSync(path.join(root, "migrations", "0003_word_score.sql")), false);
  } finally {
    cleanup(root);
  }
});

