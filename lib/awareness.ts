import { encoding, decoding } from "lib0";
import { Multicore } from "./multicore";
import { Doc } from "yjs";
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from "y-protocols";

const messageQueryAwareness = 3;
const messageAwareness = 1;

export default class AwarenessExtension {
  ext: any;

  constructor(
    doc: Doc,
    private multicore: Multicore,
    public awareness = new Awareness(doc)
  ) {
    const self = this;
    this.ext = multicore.rootFeed.registerExtension("y-awareness", {
      encoding: "binary",
      onmessage(message, peer) {
        const decoder = decoding.createDecoder(message);
        const encoder = encoding.createEncoder();
        const messageType = decoding.readVarUint(decoder);
        let sendReply = false;
        switch (messageType) {
          case messageQueryAwareness:
            encoding.writeVarUint(encoder, messageAwareness);
            encoding.writeVarUint8Array(
              encoder,
              encodeAwarenessUpdate(
                awareness,
                Array.from(awareness.getStates().keys())
              )
            );
            sendReply = true;
            break;
          case messageAwareness:
            applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), this);
            break;
        }
        if (sendReply) {
          self.ext.send(Buffer.from(encoding.toUint8Array(encoder)), peer);
        }
      },
    });
    const _awarenessChangeHandler = ({ added, updated, removed }) => {
      const changedClients = added.concat(updated).concat(removed);
      const encoderAwareness = encoding.createEncoder();
      encoding.writeVarUint(encoderAwareness, messageAwareness);
      encoding.writeVarUint8Array(
        encoderAwareness,
        encodeAwarenessUpdate(this.awareness, changedClients)
      );
      this.ext.broadcast(Buffer.from(encoding.toUint8Array(encoderAwareness)));
    };
    awareness.on("change", _awarenessChangeHandler);
    const _syncPeerHandler = (peer) => {
      const awarenessStates = awareness.getStates();
      if (awarenessStates.size > 0) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()))
        );
        self.ext.send(Buffer.from(encoding.toUint8Array(encoder)), peer);
      }
    };
    this.multicore.rootFeed.on("peer-add", _syncPeerHandler);
  }
}
