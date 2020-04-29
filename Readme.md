# Dat-Shared-Doc

[Yjs](https://github.com/yjs/yjs) shared types, with changes persisted and synchronised using Dat's
[Hypercores](https://github.com/mafintosh/hypercore/).

## Features

 * Multi-writer data structures on top of Dat, with support for both node and browsers, and history persisted to Hypercores.
 * Fine-grained control of which peers can write and add new peers.
 * Support for yjs presence, to synchronise information about online peers.

Note this library does not include a discovery component for finding and connecting to peers. You
can use [hyperswarm](https://github.com/hyperswarm/hyperswarm/) or
[discovery-swarm-webrtc](https://github.com/geut/discovery-swarm-webrtc) for this purpose.

## Usage

_WARNING: API not yet stable!_

```javascript
const { DatYDoc } = require('@sammacbeth/dat-shared-doc');
const Corestore = require('corestore')
const ram = require('random-access-memory')
const pump = require('pump')

const opts = {
  announceFeeds: true, // automatically discovery of other peers
  policy: 'GRANT_ALL_ADMIN', // every peer can write and add other peers
}
// create a new shared document
const doc1 = await DatYDoc.create(new Corestore(ram), opts)
const address = doc1.key.toString('hex'); // address of this document
await doc1.ready
// insert some text
doc1.doc.transact(() => {
  doc1.doc.getText("text").insert(0, "world");
});

// create read only copy
const doc2 = await DatYDoc.load(address, new Corestore(ram), opts);

// synchronise the corestores
const repl = doc1.store.replicate(true, { live: true })
pump(repl, doc2.store.replicate(false, { live: true }), repl);

// wait to be granted writer permissions
doc2.multicore.once('writer', () => {
  // read state of the document
  console.log(doc2.doc.getText('text').toJSON()) //= 'world'
  // update the doc
  doc2.doc.transact(() => {
    doc2.doc.getText("text").insert(0, "hello ");
  });

  // observe the update from the original
  doc1.doc.on('update', () => {
    console.log(doc1.doc.getText('text').toJSON()) //= 'hello world'
  })
})
```

## License

MIT
