const fs = require("fs");

global.sleep = function (millis) {
  // use only in worker thread, currently Chrome-only
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, millis);
};

async function main() {
  global.gs = require("./GS").create();

  try {
    global.config = fs.existsSync(".config.json") ? require("../.config.json") : require("../config.json");
    global.api = require("./Api").create();
    global.app = require("./App").create();

    // Start
    global.gs.events.on("start", async () => {
      await global.api.start();
      await global.app.start();

      console.log();
    });

    // Cleanup
    global.gs.events.on("free", async () => {
      await global.api.free();
      await global.app.free();
    });

    //
    await global.gs.start();
  } catch (e) {
    console.error(e);
  }
}

main();
