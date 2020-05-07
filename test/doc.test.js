const { expect } = require('chai');

const Corestore = require("corestore");
const ram = require("random-access-memory");
const pump = require("pump");

const { DatYDoc } = require("../");

const opts = {
  announceFeeds: false,
  policy: "GRANT_NONE",
};

async function createInMemory() {
  const store = new Corestore(ram);
  return await DatYDoc.create(store, opts);
}

async function loadInMemory(address) {
  const store = new Corestore(ram);
  return await DatYDoc.load(address, store, opts);
}

describe('shared doc', () => {
  describe("create & load", () => {
    it("create", async () => {
      const doc = await createInMemory();
      expect(doc.key).to.have.length(32);
      await doc.ready;
      expect(doc.writable).to.be.true;
      expect(doc.isAdmin).to.be.true;
      await doc.close();
    });

    it("load", async () => {
      const addr =
        "40fb7c496f12c420f53c6ba3cf3af06566f27886a1153365d7c99937c34bcb2e";
      const doc = await loadInMemory(addr);
      expect(doc.key).to.have.length(32);
      expect(doc.key.toString("hex")).to.equal(addr);
      await doc.ready;
      expect(doc.writable).to.be.false;
      expect(doc.isAdmin).to.be.false;
      await doc.close();
    });

    it("create then load", async () => {
      const d1 = await createInMemory();
      await d1.ready;
      d1.doc.transact(() => {
        d1.doc.getText("test").insert(0, "hello");
      });
      d1.close();

      // recreate with the original store
      const d2 = new DatYDoc(d1.key, d1.store, opts);
      await d2.ready;
      const text = d1.doc.getText("test");
      expect(text.toJSON()).to.eql("hello");
    });

    it("load and replicate", async () => {
      const d1 = await createInMemory();
      const d2 = await loadInMemory(d1.key.toString("hex"));
      await d1.ready;
      await d2.ready;

      d1.doc.transact(() => {
        d1.doc.getText("test").insert(0, "hello");
      });
      const repl1 = d1.store.replicate(true, { live: true });
      pump(repl1, d2.store.replicate(false, { live: true }), repl1);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const text = d1.doc.getText("test");
      expect(text.toJSON()).to.eql("hello");

      await d1.close();
      await d2.close();
    });
  });
});
