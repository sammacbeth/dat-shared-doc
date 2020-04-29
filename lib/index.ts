import { Doc } from "yjs";
import { Corestore } from "./types";
import FeedAnnounceExtension from "./feed-announce";
import { Multicore, METADATA_NAME } from "./multicore";
import YDocHandler from "./ydoc";
import AwarenessExtension from "./awareness";

const DOC_NAME = 'ydoc';

export type Options = {
  announceFeeds?: boolean;
  awareness?: boolean;
  policy: "GRANT_ALL_ADMIN" | "GRANT_ALL_WRITER" | "GRANT_NONE";
};

export {
  YDocHandler,
  Multicore,
}

export class DatYDoc {
  key: Buffer;
  discoveryKey: Buffer;
  ready: Promise<void>;

  multicore: Multicore;
  doc: Doc;

  feedAnnouncer: FeedAnnounceExtension;
  awareness: AwarenessExtension;
  announceTimer: NodeJS.Timeout;

  static create(store: Corestore, opts: Options): Promise<DatYDoc> {
    return new Promise((resolve) => {
      store.ready(() => {
        resolve(
          new DatYDoc(store.namespace(METADATA_NAME).default().key, store, opts)
        );
      });
    });
  }

  static load(key: string, store: Corestore, opts: Options): Promise<DatYDoc> {
    return new Promise((resolve) => {
      store.ready(() => {
        resolve(new DatYDoc(Buffer.from(key, "hex"), store, opts));
      });
    });
  }

  constructor(
    root: Buffer,
    public store: Corestore,
    public readonly opts: Options
  ) {
    this.multicore = new Multicore(root, store);
    const docHandler = new YDocHandler(DOC_NAME);
    this.multicore.addHandler(docHandler);
    this.doc = docHandler.doc;
    this.key = this.multicore.key;
    this.ready = new Promise(async (resolve) => {
      await this.multicore.ready(METADATA_NAME);
      if (this.isAdmin && !this.writable) {
        await this.multicore.authorise(DOC_NAME, this.multicore.getFeed(DOC_NAME).key);
      }
      this.discoveryKey = this.multicore.discoveryKey;
      if (!this.isAdmin && !this.writable) {
        const requestWriter = () => {
          this.announceTimer = null;
          if (!this.writable && opts.announceFeeds) {
            this.feedAnnouncer.announce();
            this.announceTimer = setTimeout(requestWriter, 5000);
          }
        };
        this.multicore.on("writer", (type) => {
          if (type === METADATA_NAME && !this.writable) {
            this.multicore.authorise(
              DOC_NAME,
              this.multicore.getFeed(DOC_NAME).key
            );
          }
        });
        requestWriter();
      }
      resolve();
    });

    // extension to find out about new feeds
    if (opts.announceFeeds) {
      this.feedAnnouncer = new FeedAnnounceExtension(this.multicore);
      this.feedAnnouncer.on("feeds", (feeds: { [kind: string]: string }) => {
        if (this.isAdmin) {
          if (opts.policy === "GRANT_ALL_ADMIN" && feeds.metadata) {
            this.multicore.authorise(METADATA_NAME, feeds.metadata);
          } else if (opts.policy === "GRANT_ALL_WRITER" && feeds[DOC_NAME]) {
            this.multicore.authorise(DOC_NAME, feeds[DOC_NAME]);
          }
        }
      });
    }
    if (opts.awareness) {
      this.awareness = new AwarenessExtension(this.multicore.metadataHandler.doc, this.multicore);
    }
  }

  docReady() {
    return this.multicore.ready(DOC_NAME);
  }

  get writable() {
    return this.multicore.isWriter(DOC_NAME);
  }

  get isAdmin() {
    return this.multicore.isAdmin;
  }

  async close() {
    if (this.announceTimer) {
      clearTimeout(this.announceTimer);
    }
  }
}
