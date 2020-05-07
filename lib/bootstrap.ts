import { HypercoreProtocolExtension } from "./types";
import { Multicore } from "./multicore";
import { EventEmitter } from "events";

export default class FeedBootstrapExtension extends EventEmitter {
  ext: HypercoreProtocolExtension;

  constructor(multicore: Multicore) {
    super();
    const self = this;
    this.ext = multicore.rootFeed.registerExtension("feed-bootstrap", {
      encoding: "json",
      onmessage(message) {
        const feedsLoading = [];
        for (const [key, kind, ptr] of message) {
          if (multicore.handlers[kind]) {
            feedsLoading.push(multicore.loadFeed(kind, key, ptr));
          }
        }
        Promise.all(feedsLoading).then(() => {
          self.emit("bootstrapped", message);
        });
      },
    });
    multicore.rootFeed.on("peer-open", (peer) => {
      const msg = [];
      for (const [key, feed] of multicore.activeFeeds) {
        msg.push([key, feed.kind, feed.readPtr]);
      }
      this.ext.send(msg, peer);
    });
  }
}
