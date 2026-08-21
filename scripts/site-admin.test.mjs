import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createSiteAdminServer } from "./site-admin-tools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const token = "local-test-token-with-enough-entropy";
const checkedInBlueprint = JSON.parse(fs.readFileSync(path.join(root, "site", "blueprint.json"), "utf8"));

test("ships syntactically valid browser-side studio code", () => {
  const result = spawnSync(process.execPath, ["--check", path.join(root, "admin", "app.js")], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
});

async function withServer(run) {
  const server = createSiteAdminServer({ root, token });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("serves the local studio but protects every data endpoint", async () => {
  await withServer(async (origin) => {
    const page = await fetch(`${origin}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Local Site Studio/);

    const unauthorized = await fetch(`${origin}/api/blueprint`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${origin}/api/blueprint`, {
      headers: { "X-Site-Admin-Token": token },
    });
    const payload = await authorized.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.blueprint.site.id, checkedInBlueprint.site.id);
    assert.match(payload.revision, /^[a-f0-9]{64}$/);
    assert.deepEqual(payload.competitionAdapters.map((adapter) => adapter.id), ["1v1-lol", "word-score"]);

    const resources = await fetch(`${origin}/api/resources`, { headers: { "X-Site-Admin-Token": token } }).then((response) => response.json());
    assert.equal(resources.ok, true);
    assert.ok(resources.images.length > 0);
    const localImagePath = resources.images[0].path;

    const image = await fetch(`${origin}/preview/public/${localImagePath.replace(/^\/+/, "")}`);
    assert.equal(image.status, 200);
    assert.match(image.headers.get("content-type") || "", /^image\//);
  });
});

test("previews the checked-in blueprint without writing files", async () => {
  const blueprintPath = path.join(root, "site", "blueprint.json");
  const before = fs.readFileSync(blueprintPath);
  await withServer(async (origin) => {
    const current = await fetch(`${origin}/api/blueprint`, { headers: { "X-Site-Admin-Token": token } }).then((response) => response.json());
    const response = await fetch(`${origin}/api/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Site-Admin-Token": token, Origin: origin },
      body: JSON.stringify({ blueprint: current.blueprint, baseRevision: current.revision }),
    });
    const preview = await response.json();
    assert.equal(response.status, 200);
    assert.equal(preview.ok, true);
    assert.equal(preview.status, "current");
    assert.deepEqual(preview.changes, []);
    assert.equal(preview.diskChanged, false);
  });
  assert.equal(fs.readFileSync(blueprintPath).equals(before), true);
});

test("rejects foreign origins and stale or unconfirmed saves", async () => {
  await withServer(async (origin) => {
    const current = await fetch(`${origin}/api/blueprint`, { headers: { "X-Site-Admin-Token": token } }).then((response) => response.json());
    const foreign = await fetch(`${origin}/api/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Site-Admin-Token": token, Origin: "https://example.com" },
      body: JSON.stringify({ blueprint: current.blueprint, baseRevision: current.revision }),
    });
    assert.equal(foreign.status, 403);

    const unconfirmed = await fetch(`${origin}/api/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Site-Admin-Token": token, Origin: origin },
      body: JSON.stringify({ blueprint: current.blueprint, baseRevision: current.revision, previewDigest: "stale", confirm: "wrong" }),
    });
    assert.equal(unconfirmed.status, 400);
  });
});
