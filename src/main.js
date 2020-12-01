const fs = require("fs-extra");

async function main() {
  global.gsm = require("graceful-shutdown-manager").Manager.create();

  try {
    global.config = (await fs.exists(".config.json")) ? require("../.config.json") : require("../config.json");
    global.api = require("./Api").create();
    global.app = require("./App").create();

    // Start
    global.gsm.events.on("init", async () => {
      await global.api.init();
      await global.app.init();
    });

    // Main
    global.gsm.events.on("main", async () => {
      global.app.main();
    });

    // Cleanup
    global.gsm.events.on("free", async () => {
      await global.api.free();
      await global.app.free();
    });

    await global.gsm.main();
  } catch (e) {
    console.error(e);
    global.gsm.exit();
  }
}

main();
