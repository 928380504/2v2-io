import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_HEADINGS = [
  "快速理解",
  "架构与优先级",
  "目录结构",
  "页面与路由",
  "站点配置",
  "游戏数据",
  "组件插槽",
  "动态数据与缓存",
  "Pages Functions 与 D1",
  "构建与部署",
  "模板版本与多站同步",
  "保护区",
  "AI 修改协议",
  "常见问题",
  "当前限制与下一步",
];

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return null;
  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^([a-z_]+):\s*(.*?)\s*$/i))
      .filter(Boolean)
      .map((entry) => [entry[1], entry[2].replace(/^['"]|['"]$/g, "")]),
  );
}

export function validateTemplateDocs({ root = process.cwd(), expectedVersion } = {}) {
  const errors = [];
  const definitionPath = path.join(root, "template", "template.json");
  const guidePath = path.join(root, "TEMPLATE-GUIDE.md");
  const changelogPath = path.join(root, "CHANGELOG.md");
  const agentsPath = path.join(root, "AGENTS.md");
  const competitionSpecPath = path.join(
    root,
    "docs",
    "COMPETITION-FEED-LEADERBOARD-SPEC.md",
  );

  for (const filePath of [
    definitionPath,
    guidePath,
    changelogPath,
    agentsPath,
    competitionSpecPath,
  ]) {
    if (!fs.existsSync(filePath)) {
      errors.push(`Required documentation file is missing: ${path.relative(root, filePath)}`);
    }
  }
  if (errors.length) return errors;

  const definition = JSON.parse(fs.readFileSync(definitionPath, "utf8"));
  const guide = fs.readFileSync(guidePath, "utf8");
  const changelog = fs.readFileSync(changelogPath, "utf8");
  const agents = fs.readFileSync(agentsPath, "utf8");
  const competitionSpec = fs.readFileSync(competitionSpecPath, "utf8");
  const metadata = parseFrontmatter(guide);
  const version = String(expectedVersion || definition.version || "");

  if (!metadata) {
    errors.push("TEMPLATE-GUIDE.md must start with YAML-style frontmatter.");
  } else {
    if (metadata.template !== definition.templateId) {
      errors.push(`Guide template ID must be ${definition.templateId}.`);
    }
    if (metadata.version !== version) {
      errors.push(`Guide version ${metadata.version || "missing"} must match ${version}.`);
    }
    if (Number(metadata.documentation_revision) !== Number(definition.documentationRevision)) {
      errors.push(
        `Guide documentation_revision must match template documentationRevision (${definition.documentationRevision}).`,
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.last_verified || "")) {
      errors.push("Guide last_verified must use YYYY-MM-DD.");
    } else if (Number.isNaN(Date.parse(`${metadata.last_verified}T00:00:00Z`))) {
      errors.push("Guide last_verified is not a valid date.");
    }
    if (!new Set(["development", "stable"]).has(metadata.status)) {
      errors.push('Guide status must be "development" or "stable".');
    }
  }

  REQUIRED_HEADINGS.forEach((heading) => {
    if (!guide.includes(`## ${heading}`)) {
      errors.push(`TEMPLATE-GUIDE.md is missing required section: ${heading}`);
    }
  });

  if (!changelog.includes("## [Unreleased]")) {
    errors.push("CHANGELOG.md must contain an Unreleased section.");
  }
  if (!changelog.includes(`## [${version}]`)) {
    errors.push(`CHANGELOG.md must contain a ${version} release entry.`);
  }
  if (!guide.includes("npm run cloudflare:provision")) {
    errors.push("TEMPLATE-GUIDE.md must document the fresh D1 provisioning command.");
  }

  [
    "TEMPLATE-GUIDE.md",
    "CHANGELOG.md",
    "template/template.json",
    "npm run docs:check",
    "npm run backend:check",
    "npm run competition:install:test",
    "npm run filters:check",
    "npm run game:add:test",
    "npm run site:create:test",
    "npm run site:export:test",
    "npm run site:admin:test",
    "npm run cloudflare:test",
    "npm run template:fleet:test",
    "npm run site:adopt-legacy:test",
    "npm run functions:migrate:test",
    "npm run validate-site",
    "npm run build",
    "docs/COMPETITION-FEED-LEADERBOARD-SPEC.md",
  ].forEach((requiredText) => {
    if (!agents.includes(requiredText)) {
      errors.push(`AGENTS.md must mention: ${requiredText}`);
    }
  });

  const corePaths = new Set(definition.corePaths || []);
  ["AGENTS.md", "CHANGELOG.md", "TEMPLATE-GUIDE.md", "docs"].forEach((filePath) => {
    if (!corePaths.has(filePath)) {
      errors.push(`Template corePaths must include documentation file: ${filePath}`);
    }
  });

  [
    "固定层与可变层",
    "游戏结算事件",
    "跑马灯数据契约",
    "跑马灯内容与视觉规范",
    "排行榜数据契约",
    "排名、分页和个人窗口",
    "周期、时区和领奖台",
    "缓存与刷新",
    "新适配器验收清单",
  ].forEach((heading) => {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(`^## (?:\\d+\\.\\s+)?${escaped}$`, "m").test(competitionSpec)) {
      errors.push(`Competition UI specification is missing section: ${heading}`);
    }
  });

  for (const contractText of [
    "/api/ticker",
    "/api/leaderboard/",
    "profile.ready",
    "matches.pending",
    "matches.ack",
    "metricField",
    "currentWindow",
    "dataSource",
    "localStorage",
  ]) {
    if (!competitionSpec.includes(contractText)) {
      errors.push(`Competition UI specification must mention: ${contractText}`);
    }
  }

  return errors;
}

const currentFile = fileURLToPath(import.meta.url);
if (
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(currentFile).toLowerCase()
) {
  const errors = validateTemplateDocs();
  if (errors.length) {
    errors.forEach((message) => console.error(`ERROR ${message}`));
    console.error(`Template documentation validation failed with ${errors.length} error(s).`);
    process.exit(1);
  }
  const definition = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "template", "template.json"), "utf8"),
  );
  console.log(
    `Template documentation passed: ${definition.templateId} ${definition.version}, revision ${definition.documentationRevision}.`,
  );
}
