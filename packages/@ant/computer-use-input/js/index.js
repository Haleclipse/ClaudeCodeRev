const path = require("path");

// Discriminated union: { isSupported: false } on non-darwin,
// { isSupported: true, ...nativeFns } on darwin. Cross-platform consumers
// (claude-cli-internal) require() unconditionally and narrow on isSupported.
if (process.platform !== "darwin") {
  module.exports = { isSupported: false };
} else {
  // COMPUTER_USE_INPUT_NODE_PATH: escape hatch for bundlers. Bun's --compile
  // embeds the .node as an asset, not in a node_modules tree — __dirname is
  // the exe dir and ../prebuilds/ doesn't exist. The consuming build bakes
  // this var to the embedded asset's path. Unset → normal node_modules layout.
  //
  // key()/keys() dispatch enigo work onto DispatchQueue.main via
  // dispatch2::run_on_main, then block a tokio worker on a channel. Under
  // Electron (CFRunLoop drains the main queue) this works; under libuv
  // (Node/bun) the main queue never drains and the promise hangs. Consumers
  // running under libuv must pump CFRunLoop while key()/keys() are pending —
  // e.g. claude-cli-internal borrows @ant/computer-use-swift's _drainMainRunLoop.
  const native = require(
    process.env.COMPUTER_USE_INPUT_NODE_PATH ??
      path.resolve(__dirname, "../prebuilds/computer-use-input.node"),
  );
  module.exports = { isSupported: true, ...native };
}
