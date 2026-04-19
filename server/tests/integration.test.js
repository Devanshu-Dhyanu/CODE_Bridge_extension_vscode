const assert = require("node:assert/strict");
const { once } = require("node:events");
const { mkdtempSync, rmSync } = require("node:fs");
const net = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { io } = require("socket.io-client");
const parser = require("socket.io-msgpack-parser");
const Y = require("yjs");
const { createCollabServer } = require("../dist/serverApp.js");
const { toUint8Array } = require("../dist/binary.js");

async function main() {
  await persistsRoomsAcrossRestart();
  await rateLimitsRepeatedRoomCreation();
  await acceptsArrayBufferDocumentUpdates();
  console.log("server integration checks passed");
}

async function persistsRoomsAcrossRestart() {
  const tempDir = mkdtempSync(join(tmpdir(), "collabcode-server-"));
  const dbPath = join(tempDir, "collabcode.sqlite");
  const adminSecret = "admin-secret";
  const inviteSecret = "invite-secret";
  const firstPort = await getFreePort();
  const firstServer = await startServer({
    adminSecret,
    chatMessageLimit: 8,
    chatMessageWindowMs: 10000,
    cleanupIntervalMs: 300000,
    corsOrigin: "*",
    createRoomLimit: 12,
    createRoomWindowMs: 600000,
    cursorUpdateLimit: 120,
    cursorUpdateWindowMs: 10000,
    dbPath,
    inviteSecret,
    inviteTokenTtlHours: 168,
    joinRoomLimit: 40,
    joinRoomWindowMs: 600000,
    maxUsersPerRoom: 20,
    port: firstPort,
    roomTtlHours: 168,
  });

  try {
    const healthResponse = await fetch(`http://127.0.0.1:${firstPort}/health`);
    const health = await healthResponse.json();
    assert.equal(health.status, "ok");
    assert.equal(health.protocolVersion, "1");

    const hostSocket = await connectSocket(firstPort);
    const createResponse = await emitWithAck(hostSocket, "create-room", {
      roomId: "persisted-room",
      userName: "Host",
      documentName: "lesson.ts",
      languageId: "typescript",
      initialCode: "console.log('hello');",
      clientVersion: "1.1.0",
    });

    assert.equal(createResponse.ok, true);
    assert.ok(createResponse.studentInviteToken);

    hostSocket.disconnect();
    await firstServer.close();

    const secondPort = await getFreePort();
    const secondServer = await startServer({
      adminSecret,
      chatMessageLimit: 8,
      chatMessageWindowMs: 10000,
      cleanupIntervalMs: 300000,
      corsOrigin: "*",
      createRoomLimit: 12,
      createRoomWindowMs: 600000,
      cursorUpdateLimit: 120,
      cursorUpdateWindowMs: 10000,
      dbPath,
      inviteSecret,
      inviteTokenTtlHours: 168,
      joinRoomLimit: 40,
      joinRoomWindowMs: 600000,
      maxUsersPerRoom: 20,
      port: secondPort,
      roomTtlHours: 168,
    });

    try {
      const hiddenRoomsResponse = await fetch(`http://127.0.0.1:${secondPort}/rooms`);
      assert.equal(hiddenRoomsResponse.status, 404);

      const adminRoomsResponse = await fetch(`http://127.0.0.1:${secondPort}/rooms`, {
        headers: {
          "x-collabcode-admin-secret": adminSecret,
        },
      });
      const roomsPayload = await adminRoomsResponse.json();
      assert.equal(roomsPayload.rooms.length, 1);
      assert.equal(roomsPayload.rooms[0].id, "persisted-room");

      const studentSocket = await connectSocket(secondPort);
      studentSocket.emit("join-room", {
        inviteToken: createResponse.studentInviteToken,
        userName: "Student",
        clientVersion: "1.1.0",
      });
      const [roomState] = await once(studentSocket, "room-state");
      assert.equal(roomState.room.id, "persisted-room");
      assert.equal(roomState.protocolVersion, "1");
      assert.equal(roomState.serverVersion, "1.1.0");
      studentSocket.disconnect();
    } finally {
      await secondServer.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function rateLimitsRepeatedRoomCreation() {
  const tempDir = mkdtempSync(join(tmpdir(), "collabcode-ratelimit-"));
  const dbPath = join(tempDir, "collabcode.sqlite");
  const port = await getFreePort();
  const server = await startServer({
    adminSecret: "",
    chatMessageLimit: 8,
    chatMessageWindowMs: 10000,
    cleanupIntervalMs: 300000,
    corsOrigin: "*",
    createRoomLimit: 1,
    createRoomWindowMs: 60000,
    cursorUpdateLimit: 120,
    cursorUpdateWindowMs: 10000,
    dbPath,
    inviteSecret: "invite-secret",
    inviteTokenTtlHours: 168,
    joinRoomLimit: 40,
    joinRoomWindowMs: 600000,
    maxUsersPerRoom: 20,
    port,
    roomTtlHours: 168,
  });

  try {
    const firstSocket = await connectSocket(port);
    const secondSocket = await connectSocket(port);

    const firstCreate = await emitWithAck(firstSocket, "create-room", {
      roomId: "room-one",
      userName: "Host One",
      documentName: "a.ts",
      languageId: "typescript",
      initialCode: "",
      clientVersion: "1.1.0",
    });
    assert.equal(firstCreate.ok, true);

    const secondCreate = await emitWithAck(secondSocket, "create-room", {
      roomId: "room-two",
      userName: "Host Two",
      documentName: "b.ts",
      languageId: "typescript",
      initialCode: "",
      clientVersion: "1.1.0",
    });
    assert.equal(secondCreate.ok, false);
    assert.equal(secondCreate.code, "rate-limited");

    firstSocket.disconnect();
    secondSocket.disconnect();
  } finally {
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function acceptsArrayBufferDocumentUpdates() {
  const tempDir = mkdtempSync(join(tmpdir(), "collabcode-yjs-update-"));
  const dbPath = join(tempDir, "collabcode.sqlite");
  const port = await getFreePort();
  const server = await startServer({
    adminSecret: "",
    chatMessageLimit: 8,
    chatMessageWindowMs: 10000,
    cleanupIntervalMs: 300000,
    corsOrigin: "*",
    createRoomLimit: 12,
    createRoomWindowMs: 600000,
    cursorUpdateLimit: 120,
    cursorUpdateWindowMs: 10000,
    dbPath,
    inviteSecret: "invite-secret",
    inviteTokenTtlHours: 168,
    joinRoomLimit: 40,
    joinRoomWindowMs: 600000,
    maxUsersPerRoom: 20,
    port,
    roomTtlHours: 168,
  });

  try {
    const hostSocket = await connectSocket(port);
    const studentSocket = await connectSocket(port);

    const createResponse = await emitWithAck(hostSocket, "create-room", {
      roomId: "array-buffer-room",
      userName: "Host",
      documentName: "lesson.ts",
      languageId: "typescript",
      initialCode: "",
      clientVersion: "1.1.0",
    });

    assert.equal(createResponse.ok, true);

    studentSocket.emit("join-room", {
      inviteToken: createResponse.studentInviteToken,
      userName: "Student",
      clientVersion: "1.1.0",
    });
    await once(studentSocket, "room-state");

    const ydoc = new Y.Doc();
    ydoc.getText("code").insert(0, "console.log('synced');");
    const encodedUpdate = Y.encodeStateAsUpdate(ydoc);
    const arrayBufferUpdate = encodedUpdate.buffer.slice(
      encodedUpdate.byteOffset,
      encodedUpdate.byteOffset + encodedUpdate.byteLength,
    );

    hostSocket.emit("yjs-update", {
      roomId: "array-buffer-room",
      update: arrayBufferUpdate,
    });

    const [broadcastPayload] = await once(studentSocket, "yjs-update");
    const normalizedUpdate = toUint8Array(broadcastPayload.update);
    assert.equal(broadcastPayload.roomId, "array-buffer-room");

    const replicatedDoc = new Y.Doc();
    Y.applyUpdate(replicatedDoc, normalizedUpdate);
    assert.equal(replicatedDoc.getText("code").toString(), "console.log('synced');");

    const roomState = server.roomManager.getRoomState("array-buffer-room", hostSocket.id);
    assert.equal(roomState.room.document.code, "console.log('synced');");

    hostSocket.disconnect();
    studentSocket.disconnect();
  } finally {
    await server.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function emitWithAck(socket, eventName, payload) {
  return await new Promise((resolve, reject) => {
    socket.timeout(5000).emit(eventName, payload, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(response);
    });
  });
}

async function connectSocket(port) {
  const socket = io(`http://127.0.0.1:${port}`, {
    parser,
    transports: ["websocket"],
    timeout: 5000,
  });

  await once(socket, "connect");
  return socket;
}

async function startServer(options) {
  const server = createCollabServer(options);
  await server.listen();
  return server;
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to determine a free TCP port."));
        return;
      }

      const { port } = address;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
