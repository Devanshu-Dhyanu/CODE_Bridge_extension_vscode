const assert = require("node:assert/strict");
const { existsSync, statSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const Y = require("yjs");

function main() {
  const extensionRoot = join(__dirname, "..");
  const packageJson = JSON.parse(
    readFileSync(join(extensionRoot, "package.json"), "utf8"),
  );

  assert.equal(
    packageJson.contributes.configuration.properties["collabCode.serverUrl"].default,
    "https://code-collab-5qo3.onrender.com",
  );

  const commands = packageJson.contributes.commands.map((command) => command.command);
  assert.ok(commands.includes("collabCode.copyStudentInviteToken"));
  assert.ok(commands.includes("collabCode.openGettingStarted"));
  assert.equal(
    packageJson.contributes.views.collabCode.find((view) => view.id === "collabCode.room").type,
    "webview",
  );

  const expectedFiles = [
    "README.md",
    "CHANGELOG.md",
    "SUPPORT.md",
    "PRIVACY.md",
    "resources/collabcode.png",
  ];

  for (const relativePath of expectedFiles) {
    const absolutePath = join(extensionRoot, relativePath);
    assert.equal(existsSync(absolutePath), true, `${relativePath} should exist`);
  }

  assert.ok(statSync(join(extensionRoot, "resources", "collabcode.png")).size > 0);

  const { toUint8Array } = require(join(extensionRoot, "dist", "binary.js"));
  const emptyUpdate = Y.encodeStateAsUpdate(new Y.Doc());
  const arrayBufferUpdate = emptyUpdate.buffer.slice(
    emptyUpdate.byteOffset,
    emptyUpdate.byteOffset + emptyUpdate.byteLength,
  );
  const restoredUpdate = toUint8Array(arrayBufferUpdate);

  assert.equal(restoredUpdate instanceof Uint8Array, true);

  const restoredDoc = new Y.Doc();
  Y.applyUpdate(restoredDoc, restoredUpdate, "smoke");
  assert.equal(restoredDoc.getText("code").toString(), "");

  console.log("extension smoke checks passed");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
