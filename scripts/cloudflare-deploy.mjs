import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseArguments } from "./template-tools.mjs";
import {
  buildCloudflareAudit,
  buildPagesDeployArguments,
  persistProvisionedDatabaseId,
  prepareCloudflareProvisionWorkspace,
  prepareCloudflareWorkspace,
  readProvisionedDatabaseId,
  runHealthChecks,
} from "./cloudflare-deployment-tools.mjs";

const root = process.cwd();
const mode = process.argv[2] || "check";
const args = parseArguments(process.argv.slice(3));
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");

function usage() {
  console.log(`
Cloudflare Pages + D1 deployment wizard. All remote writes require --apply and
an exact --confirm token printed by the local audit.

  npm run cloudflare:check
  npm run cloudflare:provision
  npm run cloudflare:provision -- --apply --confirm <site/database/create>
  npm run cloudflare:prepare
  npm run cloudflare:prepare -- --apply
  npm run cloudflare:migrations -- --remote
  npm run cloudflare:migrations -- --remote --apply --confirm <site/database>
  npm run cloudflare:deploy
  npm run cloudflare:deploy -- --apply --confirm <site/project>
  npm run cloudflare:health -- --url https://example.pages.dev
`);
}

function printAudit(audit) {
  console.log(`Cloudflare deployment audit: ${audit.status}`);
  console.log(`Pages: ${audit.config.pagesProject} (${audit.config.productionBranch})`);
  console.log(`Production: ${audit.config.productionUrl}`);
  console.log(`D1: ${audit.config.database.name} · ${audit.config.database.binding} · ${audit.config.database.id || "ID not configured"}`);
  console.log(`D1 location: ${audit.config.database.location || "automatic"}`);
  console.log("Database lifecycle: fresh D1 per site · Wrangler-managed schema");
  console.log(`Competition: ${audit.migrationPlan.adapter}`);
  console.log(`Migrations: ${audit.migrationPlan.migrations.length}`);
  audit.migrationPlan.migrations.forEach((item) => console.log(`  ${item.name}  ${item.sha256.slice(0, 12)}`));
  console.log(`Build: html=${audit.artifacts.html} worker=${audit.artifacts.worker} routes=${audit.artifacts.routes}`);
  audit.warnings.forEach((message) => console.log(`Attention: ${message}`));
  audit.blockers.forEach((message) => console.log(`Blocker: ${message}`));
  console.log(`Migration confirmation: ${audit.confirmations.migrations}`);
  console.log(`Provision confirmation: ${audit.confirmations.provision}`);
  console.log(`Deploy confirmation: ${audit.confirmations.deploy}`);
}

function requireConfirmation(expected) {
  if (!args.apply) return false;
  if (String(args.confirm || "") !== expected) {
    throw new Error(`Remote write blocked. Repeat with --confirm ${expected}`);
  }
  return true;
}

function runWrangler(commandArgs) {
  if (!fs.existsSync(wrangler)) throw new Error("Wrangler is not installed. Run npm install first.");
  const result = spawnSync(process.execPath, [wrangler, ...commandArgs], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler failed with exit code ${result.status}.`);
}

try {
  if (args.help || !["check", "provision", "prepare", "migrations", "deploy", "health"].includes(mode)) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  const audit = buildCloudflareAudit(root);

  if (mode === "check") {
    printAudit(audit);
    process.exit(audit.blockers.length ? 1 : 0);
  }

  if (mode === "provision") {
    printAudit(audit);
    if (audit.config.database.id) {
      console.log("D1 is already configured; no database was created.");
      process.exit(0);
    }
    if (!args.apply) {
      console.log(`Preview only. A new site-exclusive D1 database named ${audit.config.database.name} will be created${audit.config.database.location ? ` in ${audit.config.database.location}` : " with automatic placement"}.`);
      console.log("The resulting UUID will be backed up and written atomically to site/cloudflare.json.");
      process.exit(0);
    }
    requireConfirmation(audit.confirmations.provision);
    const provision = prepareCloudflareProvisionWorkspace(root, audit);
    const command = [
      "d1", "create", audit.config.database.name,
      "--binding", audit.config.database.binding,
      "--update-config",
      "--config", provision.wranglerPath,
      ...(audit.config.database.location ? ["--location", audit.config.database.location] : []),
    ];
    runWrangler(command);
    const databaseId = readProvisionedDatabaseId(provision.wranglerPath, audit.config.database);
    const persisted = persistProvisionedDatabaseId(root, audit, databaseId);
    console.log(`D1 provisioned and recorded: ${databaseId}`);
    console.log(`Recoverable config backup: ${path.relative(root, persisted.backupPath)}`);
    console.log(`Next: npm run cloudflare:migrations -- --remote --apply --confirm ${audit.confirmations.migrations}`);
    process.exit(0);
  }

  if (mode === "prepare") {
    printAudit(audit);
    if (!args.apply) {
      console.log("Preview only; no workspace created. Add --apply after configuring the D1 database ID.");
      process.exit(0);
    }
    const workspace = prepareCloudflareWorkspace(root, audit);
    console.log(`Prepared local deployment workspace: ${path.relative(root, workspace.workspace)}`);
    process.exit(0);
  }

  if (mode === "migrations") {
    printAudit(audit);
    if (!args.remote && !args.preview && !args.local) {
      console.log("Preview only. Choose exactly one target: --remote, --preview, or --local.");
      process.exit(0);
    }
    const targets = [args.remote, args.preview, args.local].filter(Boolean);
    if (targets.length !== 1) throw new Error("Choose exactly one migration target.");
    if ((args.remote || args.preview) && !audit.config.database.id) {
      throw new Error("Configure database.id in site/cloudflare.json before remote migration checks.");
    }
    const workspace = prepareCloudflareWorkspace(root, audit, { local: Boolean(args.local) });
    const target = args.remote ? "--remote" : args.preview ? "--preview" : "--local";
    if (!args.apply) {
      runWrangler(["d1", "migrations", "list", audit.config.database.binding, target, "--config", workspace.wranglerPath]);
      console.log("Read-only migration check completed. Add --apply and the exact confirmation token to apply pending migrations.");
      process.exit(0);
    }
    requireConfirmation(audit.confirmations.migrations);
    runWrangler(["d1", "migrations", "apply", audit.config.database.binding, target, "--config", workspace.wranglerPath]);
    console.log("Migration command completed. Cloudflare applies each migration transactionally and records it in d1_migrations.");
    process.exit(0);
  }

  if (mode === "deploy") {
    printAudit(audit);
    if (!audit.config.database.id) {
      throw new Error("D1 is not configured. Run cloudflare:provision before deployment so Pages receives the DB binding.");
    }
    if (!Object.values(audit.artifacts).every(Boolean)) {
      throw new Error("Production build artifacts are incomplete. Run npm run build first.");
    }
    if (!args.apply) {
      console.log(`Preview only. Deployment command: wrangler pages deploy out --project-name ${audit.config.pagesProject} --branch ${audit.config.productionBranch}`);
      process.exit(0);
    }
    requireConfirmation(audit.confirmations.deploy);
    const workspace = prepareCloudflareWorkspace(root, audit);
    runWrangler(buildPagesDeployArguments(audit, workspace.workspace));
    console.log("Pages deployment completed. Run npm run cloudflare:health to verify the public site and D1-backed APIs.");
    process.exit(0);
  }

  const report = await runHealthChecks({
    config: audit.config,
    primaryGameId: audit.manifest.site.primaryGameId,
    baseUrl: args.url,
  });
  console.log(`Cloudflare health: ${report.ok ? "passed" : "failed"} (${report.origin})`);
  report.results.forEach((item) => console.log(`${item.passed ? "PASS" : "FAIL"} ${item.name} · ${item.status} · ${item.url}${item.passed ? "" : ` · ${item.detail}`}`));
  process.exit(report.ok ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
