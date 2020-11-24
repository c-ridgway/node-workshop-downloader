const fs = require("fs-extra");
const Path = require("path");
const Dir = require("node-dir");
const Base = require("./ext/Base");

class Data extends Base {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.data = {};
    this._firstRun = true;
    this._isSaving = false;
  }

  async _init() {
    // Load files
    let started = Date.now();
    let files = Dir.files(this.dataPath, { sync: true });
    if (files) {
      for (const fileName of files) {
        if (fileName.endsWith(".json")) {
          let baseName = Path.basename(fileName, ".json");

          try {
            console.log(`Loading: ${fileName}`);
            this.data[baseName] = JSON.parse(await fs.readFile(fileName));
          } catch (err) {
            let fileNameBackup = Path.join(Path.dirname(fileName), baseName + ".backup");
            this.data[baseName] = JSON.parse(await fs.readFile(fileNameBackup));
          }
        }
      }
    }

    console.log(`Started in: ${Date.now() - started}ms`);

    this.timers = [];
    this.timers.push(
      setInterval(() => {
        if (!this.isSaving()) this.save();
      }, 1 * 60 * 1000)
    );
  }

  async _free() {
    for (const timer of this.timers) clearInterval(timer);

    await this.save();
  }

  async save() {
    let promises = [];

    if (this.isChange()) {
      try {
        for (const name of Object.keys(this.data)) {
          // Loop through files
          promises.push(this.saveFile(name));
        }

        this.flagFirstRun(false);
      } catch (err) {
        console.error(err);
      }
    }

    await Promise.all(promises);
  }

  saveFile(name) {
    return new Promise((resolve, reject) => {
      let path = Path.join(this.dataPath, name + ".json");

      this.lock();
      this._isSaving = true;

      // Check if file exists on first save
      if (this.isFirstRun()) {
        if (!await fs.exists(path)) {
          fs.writeFile(path, "");
        }
      }

      // Save entry
      fs.copyFile(path, Path.join(this.dataPath, name + ".backup")).then(() => {
        fs.writeJson(path, this.data[name].then(() => {
          this._isSaving = false;
          resolve(true);
        });
      });
    }).finally(() => {
      this.unlock();
    });
  }

  isSaving() {
    return this._isSaving;
  }

  isChange() {
    return true;
  }

  flagFirstRun(value = true) {
    this._firstRun = value;
  }

  isFirstRun() {
    return this._firstRun;
  }
}

module.exports = Data;
