import { EventEmitter } from "events";
import { Multicore } from "./multicore";

interface Extension {
  send(message, peer): void;
  broadcast(message): void;
}

export default class FeedAnnounceExtension extends EventEmitter {
  ext: Extension;

  constructor(private multicore: Multicore) {
    super();
    const self = this;
    this.ext = multicore.rootFeed.registerExtension("feed-announce", {
      encoding: "json",
      onmessage: function (message: any, peer: any) {
        self.emit("feeds", message, peer);
      },
      onerror: function (err: Error) {
        console.warn("Feed announce error", err);
      },
    });
  }

  enable() {
    this.multicore.rootFeed.on('peer-open', (peer) => {
      const msg = {};
      Object.keys(this.multicore.handlers).forEach((kind) => {
        msg[kind] = this.multicore.handlers[kind].defaultFeed.key.toString("hex");
      });
      this.ext.send(msg, peer);
    })
  }
}
