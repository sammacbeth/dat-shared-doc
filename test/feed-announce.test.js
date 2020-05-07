const { expect } = require("chai");

const Corestore = require("corestore");
const ram = require("random-access-memory");
const pump = require("pump");

const { DatYDoc } = require("../");

function initStore() {
  const store = new Corestore(ram);
  return new Promise((resolve) => {
    store.ready(() => resolve(store));
  });
}

async function createPeers(opts) {
  const d1 = await DatYDoc.create(await initStore(), opts);
  const d2 = await DatYDoc.load(
    d1.key.toString("hex"),
    await initStore(),
    opts
  );
  await d1.ready;
  await d2.ready;
  const repl1 = d1.store.replicate(true, { live: true });
  pump(repl1, d2.store.replicate(false, { live: true }), repl1);
  return {
    d1,
    d2,
  };
}

describe("feed announce", () => {
  it("GRANT_ALL_ADMIN adds metadata writer", async () => {
    const opts = { announceFeeds: true, policy: "GRANT_ALL_ADMIN" };
    const { d1, d2 } = await createPeers(opts);

    return new Promise((resolve, reject) => {
      d2.multicore.once("writer", (kind) => {
        if (kind === "metadata") {
          resolve();
        } else {
          reject();
        }
      });
    });
  });

  it("GRANT_ALL_WRITER adds ydoc writer", async () => {
    const opts = { announceFeeds: true, policy: "GRANT_ALL_WRITER" };
    const { d1, d2 } = await createPeers(opts);

    return new Promise((resolve, reject) => {
      d2.multicore.once("writer", (kind) => {
        if (kind === "ydoc") {
          resolve();
        } else {
          reject();
        }
      });
    });
  });

  it("GRANT_NONE does not add writer", async () => {
    const opts = { announceFeeds: true, policy: "GRANT_NONE" };
    const { d1, d2 } = await createPeers(opts);

    return new Promise((resolve, reject) => {
      d2.multicore.once("writer", (kind) => {
        reject();
      });
      setTimeout(resolve, 500);
    });
  });
});
