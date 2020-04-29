import {
  IHypercore,
  HypercoreOptions,
} from "@sammacbeth/dat-types/lib/hypercore";
import {
  ReplicationOptions,
  IReplicableNoise,
} from "@sammacbeth/dat-types/lib/replicable";
import { Duplex } from "stream";
import { EventEmitter } from "events";

type CoreOpts = {
  key?: Buffer;
  discoveryKey?: Buffer;
} & HypercoreOptions;

type Hypercore = IHypercore &
  IReplicableNoise &
  EventEmitter & {
    registerExtension(name: string, handler: any);
  };

interface Corestore extends EventEmitter {
  default(opts?: CoreOpts): Hypercore;
  get(opts?: CoreOpts): Hypercore;
  list(): Map<string, Hypercore>;
  namespace(name: string): NamedspacedCorestore;
  replicate(isInitiator: boolean, opts?: ReplicationOptions): Duplex;
  close(cb?: () => void): void;
  ready(cb?: () => void): void;
}

interface NamedspacedCorestore extends Corestore {
  name: string;
}
