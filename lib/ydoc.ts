import { HypercoreOptions } from "@sammacbeth/dat-types/lib/hypercore";
import { Doc, applyUpdate } from "yjs";

import { FeedHandler, FeedInfo } from "./handler";
import { Hypercore } from "./types";

export default class YDocHandler implements FeedHandler {
  kind: string;
  feedOptions = <HypercoreOptions>{
    valueEncoding: "binary",
  };
  defaultFeed: Hypercore;

  doc: Doc;

  constructor(docName: string, docOptions: { gc?: boolean } = { gc: true }) {
    this.kind = docName;
    this.doc = new Doc(docOptions);
    this.doc.on("update", (update, origin) => {
      const isFeedOrigin = typeof origin === "string" && origin.length === 64;
      if (!isFeedOrigin) {
        // console.log("local update", update);
        this.defaultFeed.append(Buffer.from(update));
      }
    });
  }

  handleMessage(feed: FeedInfo, msg: Uint8Array): void {
    // console.log("remote update", msg, feed.key);
    applyUpdate(this.doc, msg, feed.key);
  }
}
