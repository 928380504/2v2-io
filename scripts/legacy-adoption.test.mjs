import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildLegacyAdoptionAudit,
  discoverLegacyRoutes,
  inferLegacyDomain,
} from "./legacy-adoption-tools.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-adoption-"));
  const targetRoot = path.join(root, "legacy");
  const templateRoot = path.join(root, "template");
  const sitePackageRoot = path.join(templateRoot, "site");
  fs.mkdirSync(path.join(targetRoot, "app", "games", "demo"), { recursive: true });
  fs.mkdirSync(path.join(targetRoot, "functions"), { recursive: true });
  fs.mkdirSync(sitePackageRoot, { recursive: true });
  fs.mkdirSync(path.join(templateRoot, "functions"), { recursive: true });
  fs.writeFileSync(path.join(targetRoot, "package.json"), "{}\n");
  fs.writeFileSync(path.join(targetRoot, "app", "page.tsx"), "export default function Page() {}\n");
  fs.writeFileSync(path.join(targetRoot, "app", "games", "demo", "page.tsx"), "export default function Page() {}\n");
  fs.writeFileSync(
    path.join(targetRoot, "next-sitemap.config.js"),
    "export default { siteUrl: 'https://example-game.com' };\n",
  );
  fs.writeFileSync(
    path.join(sitePackageRoot, "manifest.json"),
    JSON.stringify({ manifestVersion: 1, site: { domain: "example-game.com" } }),
  );
  fs.writeFileSync(path.join(templateRoot, "functions", "route.ts"), "new\n");
  fs.writeFileSync(path.join(targetRoot, "functions", "route.ts"), "old\n");
  return { root, targetRoot, templateRoot, sitePackageRoot };
}

test("infers a legacy domain and discovers routes", () => {
  const values = fixture();
  assert.equal(inferLegacyDomain(values.targetRoot), "example-game.com");
  assert.deepEqual(discoverLegacyRoutes(values.targetRoot), ["/", "/games/demo"]);
  fs.rmSync(values.root, { recursive: true, force: true });
});

test("builds a ready audit without changing the target", () => {
  const values = fixture();
  const audit = buildLegacyAdoptionAudit(values);
  assert.equal(audit.status, "ready");
  assert.equal(audit.domainMatches, true);
  assert.equal(audit.routeCount, 2);
  assert.deepEqual(audit.functionsComparison.different, ["route.ts"]);
  assert.equal(fs.existsSync(path.join(values.targetRoot, "site")), false);
  fs.rmSync(values.root, { recursive: true, force: true });
});

test("blocks a mismatched site package", () => {
  const values = fixture();
  fs.writeFileSync(
    path.join(values.sitePackageRoot, "manifest.json"),
    JSON.stringify({ manifestVersion: 1, site: { domain: "another-game.com" } }),
  );
  const audit = buildLegacyAdoptionAudit(values);
  assert.equal(audit.status, "blocked");
  assert.match(audit.blockers.join(" "), /does not match legacy domain/);
  fs.rmSync(values.root, { recursive: true, force: true });
});
