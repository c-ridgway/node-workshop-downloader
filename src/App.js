const Path = require("path");
const fs = require("fs-extra");
const Base = require("./Base");
const link = require("lnk");
const Plimit = require("p-limit");
const checkDiskSpace = require("check-disk-space");

let config = global.config;

function bytesToMb(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

class App extends Base {
  constructor() {
    super();

    if (config?.www_generate === undefined) throw new Error("Missing config.json value `www_generate`");
    if (config?.steam_concurrency === undefined) throw new Error("Missing config.json value `steam_concurrency`");

    this.pathData = Path.join(process.cwd(), "data");
    this.pathWww = Path.join(process.cwd(), "www");
    this.pathWorkshop = Path.join(this.pathData, "workshop.json");
    this.pathWorkshopOld = Path.join(this.pathData, "workshop.json.old");

    this.items = null;
    this.itemsOld = null;

    this.promises = [];

    config.exclude_keys = config.exclude_keys || [];
  }

  async _start() {
    // Clear data dir
    if (!(await fs.exists(this.pathData))) {
      await fs.mkdir(this.pathData);
      await fs.mkdir(this.pathWww);
    }

    // Save data
    this.items = await this.fetchData();

    if (await fs.exists(this.pathWorkshop)) {
      this.itemsOld = await fs.readJson(this.pathWorkshop);

      // Ensure no formatting
      if (JSON.stringify(this.items) == JSON.stringify(this.itemsOld)) {
        console.log("No `workshop.json` changes");
      } else {
        await fs.rename(this.pathWorkshop, this.pathWorkshopOld);
        await fs.writeJson(this.pathWorkshop, this.items);
      }
    } else {
      // Check disk space
      const totalSpace = Object.values(this.items).reduce((accumulator, item) => parseInt(accumulator || 0) + parseInt(item.file_size) + parseInt(item.preview_file_size));
      const totalFreeSpace = parseInt((await checkDiskSpace(this.pathWww)).free);

      if (totalSpace > totalFreeSpace) {
        throw new Error(`Not enough disk space, requires '${bytesToMb(totalSpace - totalFreeSpace)}MB' more`);
      }
    }

    await fs.writeJson(this.pathWorkshop, this.items);
    //
  }

  async _free() {}

  async process() {
    const api = global.api;

    let count = await this.fetchWorkshopItems(this.items, this.itemsOld, (i, id, item) => {
      const fileSizeMb = bytesToMb(parseInt(item.file_size) + parseInt(item.preview_file_size));
      const itemCount = Object.values(this.items).length;

      console.log(`${i}/${itemCount}: Downloaded ${id}: ${fileSizeMb} MB`);
    });

    console.log(`Mods downloaded/updated: ${count}`);
  }

  async fetchData() {
    const api = global.api;

    console.log("Downloading mod data...");
    let items = await api.fetchAllWorkshopPageItems();
    console.log(`Data: #${items.length} items`);

    // Exclude keys
    const dataKeyExclude = config.data_key_exclude;
    items = items.map((item) => {
      for (const key of dataKeyExclude) delete item[key];
      return item;
    });

    // Create lookup tables
    let lookupItems = Object.create(null);
    for (const item of items) {
      lookupItems[item.publishedfileid] = item;
    }

    return lookupItems;
  }

  async fetchWorkshopItems(items, itemsOld, functProgress) {
    const limit = Plimit(config.steam_concurrency); // Limit concurrency
    let promises = [];

    let i = 0;
    for (const [id, item] of Object.entries(items)) {
      const itemOld = itemsOld ? itemsOld[id] : null;
      promises.push(
        limit(async () => {
          if (global.isExiting()) return;

          if (await this.fetchWorkshopItem(id, item, itemOld)) {
            if (functProgress) functProgress(i + 1, id, item, itemOld);
          }

          i++;
        })
      );
    }

    await Promise.all(promises);

    return i;
  }

  async fetchWorkshopItem(id, item, itemOld) {
    const api = global.api;
    const pathDataMod = Path.join(this.pathData, id);

    try {
      this.lock();

      // Check if it needs to be updated
      if (await fs.exists(pathDataMod)) {
        if (itemOld?.time_updated === item.time_updated) return false;

        await fs.rmdir(pathDataMod, { recursive: true });
      }

      await fs.mkdir(pathDataMod);
      //

      const modFilename = this.createModFilename(id, item.time_updated);
      let promises = [];

      // Download image
      if (item.preview_url) {
        promises.push(api.download(item.preview_url, Path.join(pathDataMod, "data.jpg")));
      } else console.log("Missing jpg " + id);

      // Download mod
      if (config.www_generate) {
        // Download to www directory and systemlink to the mod directory
        promises.push(api.download(item.file_url, Path.join(this.pathWww, modFilename + ".zip")).then(() => link(Path.join(this.pathWww, modFilename + ".zip"), pathDataMod, { rename: "data.zip", type: "symbolic" })));
      } else {
        // Download to the mod directory
        promises.push(api.download(item.file_url, Path.join(pathDataMod, "data.zip")));
      }

      // Output json
      promises.push(fs.writeFile(Path.join(pathDataMod, "data.json"), JSON.stringify(item, null, 2)));

      if (itemOld) {
        //const modFilenameOld = this.createModFilename(id, itemOld.time_updated);
        //fs.rmdirSync(Path.join(pathWww, modFilenameOld + ".jpg"));
        //fs.rmdirSync(Path.join(pathWww, modFilenameOld + ".zip"));
        //fs.rmdirSync(Path.join(pathWww, modFilenameOld + ".json"));
      }
      //

      await Promise.all(promises);

      return true;
    } catch (error) {
      if (error.message.startsWith("404")) console.log("Error: " + error.message);
      await fs.rmdir(pathDataMod, { recursive: true });
    } finally {
      this.unlock();
    }

    return false;
  }

  createModFilename(id, updated) {
    let idHex = parseInt(id).toString(16);
    return `m${idHex}_${updated}`;
  }
}

module.exports = App;
