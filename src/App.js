const Path = require("path");
const fs = require("fs");
const Base = require("./Base");
const link = require("lnk");
const Plimit = require("p-limit");
const { ESTALE } = require("constants");

let config = global.config;

class App extends Base {
  constructor() {
    super();

    if (!config?.steam_concurrency) throw new Error("Missing config.json value `steam_concurrency`");

    this.pathData = Path.join(process.cwd(), "data");
    this.pathPublic = Path.join(process.cwd(), "public");
    this.pathWorkshop = Path.join(this.pathData, "workshop.json");
    this.pathWorkshopOld = Path.join(this.pathData, "workshop.json.old");

    config.exclude_keys = config.exclude_keys || [];

    // Clear data dir
    if (!fs.existsSync(this.pathData)) {
      fs.mkdirSync(this.pathData);
      fs.mkdirSync(this.pathPublic);
    }
  }

  async start() {
    return new Promise(async (resolve, reject) => {
      super.start();

      await this.process();

      resolve();
    });
  }

  async free() {
    super.free();
  }

  async process() {
    const api = global.api;

    let items, itemsOld;

    // Save data
    items = await this.fetchData();

    if (fs.existsSync(this.pathWorkshop)) {
      itemsOld = JSON.parse(fs.readFileSync(this.pathWorkshop));

      // Ensure no formatting
      if (JSON.stringify(items) == JSON.stringify(itemsOld)) {
        console.log("No `workshop.json` changes");
      } else {
        fs.renameSync(this.pathWorkshop, this.pathWorkshopOld);
      }
    }

    fs.writeFileSync(this.pathWorkshop, JSON.stringify(items, null, 2));
    //

    let count = await this.fetchWorkshopItems(items, itemsOld, (i, id, item) => {
      const fileSizeMb = ((parseInt(item.file_size) + parseInt(item.preview_file_size)) / 1024 / 1024).toFixed(2);
      const itemCount = Object.values(items).length;

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

    let count = 0;
    let i = 1;
    for (const [id, item] of Object.entries(items)) {
      const itemOld = itemsOld ? itemsOld[id] : null;
      promises.push(
        limit(async () => {
          if (await this.fetchWorkshopItem(id, item, itemOld)) {
            count++;
            if (functProgress) functProgress(i++, id, item, itemOld);
          }
        })
      );
    }

    await Promise.all(promises);

    return count;
  }

  async fetchWorkshopItem(id, item, itemOld) {
    const api = global.api;
    const pathDataMod = Path.join(this.pathData, id);

    // Check if it needs to be updated
    if (fs.existsSync(pathDataMod)) {
      if (itemOld?.time_updated === item.time_updated) return false;
      fs.rmdirSync(pathDataMod, { recursive: true });
    }

    fs.mkdirSync(pathDataMod);
    //

    try {
      // Download image
      if (item.preview_url) await api.download(item.preview_url, Path.join(pathDataMod, "data.jpg"));
      else console.log("Missing jpg " + id);

      // Download image
      await api.download(item.file_url, Path.join(pathDataMod, "data.zip"));

      // Output json
      fs.writeFileSync(Path.join(pathDataMod, "data.json"), JSON.stringify(item, null, 2));

      // Generate public symbolic links
      const modFilename = this.createModFilename(id, item.time_updated);

      if (item.preview_url) await link(Path.join(pathDataMod, "data.jpg"), this.pathPublic, { rename: modFilename + ".jpg", type: "symbolic" });
      await link(Path.join(pathDataMod, "data.zip"), this.pathPublic, { rename: modFilename + ".zip", type: "symbolic" });
      await link(Path.join(pathDataMod, "data.json"), this.pathPublic, { rename: modFilename + ".json", type: "symbolic" });

      if (itemOld) {
        const modFilenameOld = this.createModFilename(id, itemOld.time_updated);
        fs.rmdirSync(Path.join(pathPublic, modFilenameOld + ".jpg"));
        fs.rmdirSync(Path.join(pathPublic, modFilenameOld + ".zip"));
        fs.rmdirSync(Path.join(pathPublic, modFilenameOld + ".json"));
      }
      //

      return true;
    } catch (error) {
      if (error.message.startsWith("404")) console.log("Error: " + error.message);
      fs.rmdirSync(pathDataMod, { recursive: true });
    }

    return false;
  }

  createModFilename(id, updated) {
    let idHex = parseInt(id).toString(16);
    return `m${idHex}_${updated}`;
  }
}

module.exports = App;
