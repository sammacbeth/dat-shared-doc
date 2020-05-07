const { expect } = require('chai');

const Corestore = require("corestore");
const ram = require("random-access-memory");
const pump = require("pump");

const { Multicore, YDocHandler } = require("../");

function initStore() {
  const store = new Corestore(ram);
  return new Promise((resolve) => {
    store.ready(() => resolve(store));
  });
}

describe("multicore", () => {
  it("create", async () => {
    const store = await initStore();
    const root = store.namespace('metadata').default();
    const core = new Multicore(root.key, store);
    await core.ready(core.metadataHandler.kind);
    expect(core.isAdmin).to.be.true;
    expect(core.isWriter(core.metadataHandler.kind)).to.be.true;
  });

  it("load", async () => {
    const addr =
      "40fb7c496f12c420f53c6ba3cf3af06566f27886a1153365d7c99937c34bcb2e";
    const store = await initStore();
    const core = new Multicore(Buffer.from(addr, "hex"), store);
    expect(core.isAdmin).to.be.false;
    expect(core.isWriter(core.metadataHandler.kind)).to.be.false;
  });

  describe('syncing', () => {
    let store1;
    let store2;
    let core1;
    let core2;

    beforeEach(async () => {
      store1 = await initStore();
      store2 = await initStore();
      const root = store1.namespace('metadata').default();
      core1 = new Multicore(root.key, store1);
      core2 = new Multicore(root.key, store2);
      await core1.ready(core1.metadataHandler.kind);
      const repl1 = store1.replicate(true, { live: true });
      pump(repl1, store2.replicate(false, { live: true }), repl1);
    })

    afterEach((done) => {
      store1.close(() => {
        store2.close(done);
      });
    })

    it('add metadata writer', async () => {
      console.log('addr', core1.key.toString('hex'), core2.metadataHandler.defaultFeed.key.toString('hex'));
      core1.authorise(
        'metadata',
        core2.metadataHandler.defaultFeed.key,
      );
      let writerEventCalled = false;
      core2.once('writer', (type) => {
        expect(type).to.eql('metadata');
        writerEventCalled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await core2.ready(core2.metadataHandler.kind);
      expect(core2.isAdmin).to.be.true;
      expect(core2.isWriter(core2.metadataHandler.kind)).to.be.true;
      expect(writerEventCalled).to.be.true;
    });

    it('add writer for non metadata feed', async () => {
      core2.addHandler(new YDocHandler('test'));
      core1.authorise('test', core2.getFeed('test').key);
      let writerEventCalled = false;
      core2.once('writer', (type) => {
        expect(type).to.eql('test');
        writerEventCalled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      await core2.ready(core2.metadataHandler.kind);

      expect(core2.isAdmin).to.be.false;
      expect(core2.isWriter('test')).to.be.true;
      expect(writerEventCalled).to.be.true;
    });

  })
});
