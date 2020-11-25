const fs = require("fs");

async function main() {
  global.gs = require("./ext/GS").create();

  try {
    global.config = fs.existsSync(".config.json") ? require("../.config.json") : require("../config.json");
    global.api = require("./Api").create();
    global.app = require("./App").create();

    // Start
    global.gs.events.on("start", async () => {
      await global.api.start();
      await global.app.start();
    });

    // Main
    global.gs.events.on("main", async () => {
      console.log();

      global.app.process();
    });

    // Cleanup
    global.gs.events.on("free", async () => {
      await global.api.free();
      await global.app.free();
    });

    await global.gs.start();
  } catch (e) {
    console.error(e);
  }
}

main();
