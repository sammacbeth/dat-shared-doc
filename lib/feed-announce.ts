import { EventEmitter } from "events";
import { Multicore } from "./multicore";
import { HypercoreProtocolExtension } from "./types";

export default class FeedAnnounceExtension extends EventEmitter {
  ext: HypercoreProtocolExtension;

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

  getAnnounceMessage() {
    const msg = {};
    Object.keys(this.multicore.handlers).forEach((kind) => {
      msg[kind] = this.multicore.handlers[kind].defaultFeed.key.toString("hex");
    });
    return msg;
  }

  enable() {
    this.multicore.rootFeed.on('peer-open', (peer) => {
      this.ext.send(this.getAnnounceMessage(), peer);
    })
    this.ext.broadcast(this.getAnnounceMessage());
  }
}
