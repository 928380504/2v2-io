import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const exampleRoot = path.join(
  root,
  "examples",
  "competition-adapters",
  "text-twist-2-untimed",
);
const errors = [];
const requiredFiles = [
  "README.md",
  "migration.sql",
  "sample-event.json",
  "site-data-provider.example.ts",
  "game-bridge.js",
  "adapter/index.ts",
  "adapter/handlers.ts",
  "adapter/score-event.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(exampleRoot, file))) {
    errors.push(`Missing competition example file: ${file}`);
  }
}

if (!errors.length) {
  const sample = JSON.parse(
    fs.readFileSync(path.join(exampleRoot, "sample-event.json"), "utf8"),
  );
  const event = sample?.events?.[0];
  if (
    sample.events.length !== 1 ||
    event.schemaVersion !== 1 ||
    event.eventType !== "score.completed" ||
    event.gameId !== "text-twist-2-untimed" ||
    event.score?.modeKey !== "untimed" ||
    !Number.isSafeInteger(event.score?.value)
  ) {
    errors.push("The Text Twist sample event does not match the score contract.");
  }

  const migration = fs.readFileSync(path.join(exampleRoot, "migration.sql"), "utf8");
  for (const table of [
    "word_score_events",
    "word_score_player_stats",
    "word_score_live_refresh_limits",
  ]) {
    if (!migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
      errors.push(`Competition example migration is missing ${table}.`);
    }
  }
  if (/\b(guessed_words|puzzle_text|dictionary_words)\b/i.test(migration)) {
    errors.push("Competition example must not persist raw guessed words or puzzle text.");
  }

  const index = fs.readFileSync(path.join(exampleRoot, "adapter", "index.ts"), "utf8");
  const handlers = fs.readFileSync(
    path.join(exampleRoot, "adapter", "handlers.ts"),
    "utf8",
  );
  const validator = fs.readFileSync(
    path.join(exampleRoot, "adapter", "score-event.ts"),
    "utf8",
  );
  for (const marker of [
    'id: "word-score"',
    'gameId: "text-twist-2-untimed"',
    'modeKey: "untimed"',
  ]) {
    if (!index.includes(marker)) errors.push(`Adapter index is missing ${marker}.`);
  }
  for (const marker of [
    "best_score DESC",
    "best_rounds DESC",
    "best_achieved_at ASC",
    "word_score_player_stats",
  ]) {
    if (!handlers.includes(marker)) errors.push(`Adapter handlers are missing ${marker}.`);
  }
  if (!validator.includes('event.eventType !== "score.completed"')) {
    errors.push("Score event validator does not enforce score.completed.");
  }

  for (const file of ["adapter/index.ts", "adapter/handlers.ts", "adapter/score-event.ts"]) {
    const source = fs.readFileSync(path.join(exampleRoot, file), "utf8");
    const result = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        isolatedModules: true,
      },
      fileName: file,
      reportDiagnostics: true,
    });
    for (const diagnostic of result.diagnostics || []) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
      errors.push(`${file} has invalid TypeScript: ${message}`);
    }
    const builtInPath = path.join(
      root,
      "backend",
      "adapters",
      "word-score",
      path.basename(file),
    );
    if (!fs.existsSync(builtInPath) || fs.readFileSync(builtInPath, "utf8") !== source) {
      errors.push(`${file} must stay identical to the built-in word-score adapter.`);
    }
  }

  const packMigrationPath = path.join(
    root,
    "competition-packs",
    "word-score",
    "migration.sql",
  );
  if (
    !fs.existsSync(packMigrationPath) ||
    fs.readFileSync(packMigrationPath, "utf8") !== migration
  ) {
    errors.push("Text Twist example migration must match the installable word-score pack.");
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR ${error}`));
  process.exit(1);
}

console.log(
  `Competition examples passed: ${requiredFiles.length} Text Twist adapter files verified.`,
);
