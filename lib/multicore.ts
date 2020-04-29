import { Corestore, Hypercore } from "./types";
import { FeedHandler, FeedInfo } from "./handler";
import YDocHandler from "./ydoc";
import Metadata from "./metadata";
import { EventEmitter } from "events";

export const METADATA_NAME = "metadata";

export class Multicore extends EventEmitter {
  discoveryKey: Buffer;

  handlers: {
    [kind: string]: FeedHandler;
  } = {};
  metadataHandler = new YDocHandler(METADATA_NAME);
  metadata: Metadata;
  rootFeed: Hypercore;
  activeFeeds = new Map<string, FeedInfo>();

  static create(store: Corestore): Promise<Multicore> {
    return new Promise((resolve) => {
      store.ready(() => {
        resolve(
          new Multicore(store.namespace(METADATA_NAME).default().key, store)
        );
      });
    });
  }

  static load(key: Buffer, store: Corestore): Promise<Multicore> {
    return new Promise((resolve) => {
      store.ready(() => {
        resolve(new Multicore(key, store));
      });
    });
  }

  constructor(public key: Buffer, private store: Corestore) {
    super();
    this.addHandler(this.metadataHandler);
    this.metadata = new Metadata(this.metadataHandler.doc);

    const rootKey = this.key.toString("hex");
    const writerOf = new Set();
    this.loadFeed(METADATA_NAME, rootKey);
    this.metadata.on("changed", () => {
      Object.keys(this.handlers).forEach((kind) => {
        const feeds = this.metadata.getFeeds(kind);
        if (!feeds) return;
        for (const key of feeds.keys()) {
          const emitIfWritable = () => {
            if (!writerOf.has(kind) && this.activeFeeds.get(key).writable) {
              writerOf.add(kind);
              this.emit("writer", kind);
            }
          };
          if (!this.activeFeeds.has(key)) {
            this.loadFeed(kind, key).then(emitIfWritable);
          } else {
            emitIfWritable();
          }
        }
      });
    });
  }

  authorise(
    kind: string,
    key: string | Buffer,
    properties?: any
  ): Promise<void> {
    if (!this.isAdmin) {
      throw new Error("Not authorised to add feeds");
    }
    const keyStr = Buffer.isBuffer(key) ? key.toString("hex") : key;
    if (this.metadata.getFeedProperties(kind, keyStr) !== null) {
      return Promise.resolve(); // already authorised
    }
    return new Promise((resolve) => {
      console.log("authorise", kind, keyStr);
      this.metadata.once("changed", () => {
        process.nextTick(() => {
          if (this.activeFeeds.has(keyStr)) {
            return resolve(this.activeFeeds.get(keyStr).ready);
          }
          resolve();
        });
      });
      this.metadata.addFeed(kind, keyStr, properties);
    });
  }

  get isAdmin() {
    return this.isWriter(METADATA_NAME);
  }

  isWriter(kind: string) {
    const feeds = this.metadata.getFeeds(kind);
    if (!feeds) {
      return false;
    }
    for (const key of feeds.keys()) {
      if (this.activeFeeds.has(key) && this.activeFeeds.get(key).writable) {
        return true;
      }
    }
    return false;
  }

  ready(kind: string): Promise<void> {
    return new Promise(async (resolve) => {
      const ready = new Set();
      for (const info of this.activeFeeds.values()) {
        if (info.kind === kind && info.ready) {
          await info.ready;
        }
        ready.add(info.key);
      }
      // if the feeds size changed while waiting rerun the check
      if (ready.size !== this.activeFeeds.size) {
        await this.ready(kind);
      }
      resolve();
    });
  }

  addHandler(handler: FeedHandler) {
    this.handlers[handler.kind] = handler;
    handler.defaultFeed = this.getFeed(handler.kind);
  }

  loadFeed(kind: string, key: string): Promise<void> {
    if (!this.handlers[kind]) {
      throw new Error(`no handler found for feed of type ${kind}`);
    }
    const handler = this.handlers[kind];
    const feed = this.store.namespace(kind).get({
      key: Buffer.from(key, "hex"),
      ...handler.feedOptions,
    });
    const info: FeedInfo = {
      kind,
      key,
      readPtr: 0,
      writable: null,
    };
    this.activeFeeds.set(key, info);
    info.ready = new Promise<void>((resolve) => {
      feed.ready(() => {
        info.writable = feed.writable;
        // special actions after loading root key
        if (feed.key.equals(this.key)) {
          this.discoveryKey = feed.discoveryKey;
          if (feed.writable && feed.length === 0) {
            this.metadata.addFeed(METADATA_NAME, key);
          }
        }
        resolve(this._onAppend(kind, key, feed));
      });
      feed.on("append", () => this._onAppend(kind, key, feed));
    });
    if (feed.key.equals(this.key)) {
      this.rootFeed = feed;
    }
    return info.ready;
  }

  getFeed(kind: string) {
    const namespace = this.store.namespace(kind);
    return namespace.default(this.handlers[kind].feedOptions);
  }

  _onAppend(kind: string, key: string, feed: Hypercore): Promise<void> {
    const info = this.activeFeeds.get(key);
    info.properties = this.metadata.getFeedProperties(kind, key);
    const ptr = info.readPtr;
    if (ptr === feed.length) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      feed.getBatch(ptr, feed.length, (err, updates) => {
        if (err) {
          info.readPtr = ptr;
          return reject(err);
        }
        updates.forEach((msg) => {
          this.handlers[kind].handleMessage(info, msg);
        });
        resolve();
      });
      info.readPtr = feed.length;
    });
  }
}
