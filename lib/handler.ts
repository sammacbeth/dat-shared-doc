import { HypercoreOptions } from "@sammacbeth/dat-types/lib/hypercore";
import { Hypercore } from "./types";

export type FeedInfo = {
  kind: string;
  key: string;
  readPtr: number;
  writable: boolean;
  ready?: Promise<void>;
  properties?: any;
};

export interface FeedHandler {
  kind: string;
  feedOptions?: HypercoreOptions;
  defaultFeed: Hypercore;
  handleMessage(feed: FeedInfo, msg: any): void;
}
