const fs = require("fs-extra");

async function main() {
  global.gs = require("./ext/GS").create();

  try {
    global.config = (await fs.exists(".config.json")) ? require("../.config.json") : require("../config.json");
    global.api = require("./Api").create();
    global.app = require("./App").create();

    // Start
    global.gs.events.on("init", async () => {
      await global.api.init();
      await global.app.init();
    });

    // Main
    global.gs.events.on("main", async () => {
      global.app.main();
    });

    // Cleanup
    global.gs.events.on("free", async () => {
      await global.api.free();
      await global.app.free();
    });

    await global.gs.main();
  } catch (e) {
    console.error(e);
  }
}

main();
