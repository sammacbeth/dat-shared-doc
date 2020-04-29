import { Doc, Map as YMap } from "yjs";
import { EventEmitter } from "events";

export default class Metadata extends EventEmitter {

  feeds: YMap<YMap<Object>>;

  constructor(private doc: Doc) {
    super();
    this.feeds = doc.getMap('feeds');
    this.feeds.observeDeep((event) => {
      this.emit('changed');
    })
  }

  addFeed(kind: string, key: string, properties: Object = {}) {
    this.doc.transact(() => {
      if (!this.feeds.has(kind)) {
        this.feeds.set(kind, new YMap());
      }
      const feedsOfKind = this.feeds.get(kind);
      if (feedsOfKind.has(key)) {
        throw new Error('feed already exists');
      }
      feedsOfKind.set(key, properties);
    })
  }

  getFeeds(kind: string): YMap<Object> {
    if (!this.feeds.has(kind)) {
      return null;
    }
    return this.feeds.get(kind)
  }

  getFeedProperties(kind: string, key: string): Object {
    const feeds = this.getFeeds(kind);
    if (!feeds || !feeds.has(key)) {
      return null;
    }
    return feeds.get(key);
  }

}