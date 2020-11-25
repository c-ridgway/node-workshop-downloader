const Path = require("path");
const Base = require("./ext/Base");
const Axios = require("axios");
const Plimit = require("p-limit");
const fs = require("fs");

const config = global.config;

class Api extends Base {
  constructor() {
    super();

    if (config?.steam_api_key === undefined) throw new Error("Missing config.json value `steam_api_config`");

    this.errors = {
      failedConnectApi: "Failed to connect to the steam workshop, check your connection",
      invalidGameId: "Invalid config.json value `steam_game_id`",
    };

    this.steamWorkshopQueryFilesUrl = `https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?key=${config.steam_api_key}&return_tags=1&return_details=1&return_metadata=1&appid=${config.steam_game_id}`;
  }

  async _init() {
    await this.test();
  }

  async _free() {}

  // Test connectivity to steam api
  async test() {
    await Axios.get(`${this.steamWorkshopQueryFilesUrl}`)
      .then(({ data }) => {
        const result = data?.response?.total;
        if (result === undefined) throw new Error(this.errors.failedConnectApi);
        if (result === 0) throw new Error(this.errors.invalidGameId);
      })
      .catch((e) => {
        throw new Error(e.message);
      });
  }

  // Gets the number of 'pages' required to obtain all of the workshop items
  async fetchWorkshopPageCount() {
    const { data } = await Axios.get(`${this.steamWorkshopQueryFilesUrl}`);
    return parseInt(data.response.total);
  }

  // Gets all the items of an associated 'page'
  async fetchWorkshopPageItems(index) {
    const { data } = await Axios.get(`${this.steamWorkshopQueryFilesUrl}&numperpage=100&page=${index}`);
    return data.response.publishedfiledetails;
  }

  // Fetches all workshop items for a steam game
  async fetchAllWorkshopPageItems() {
    const limit = Plimit(config.steam_concurrency); // Limit concurrency
    const pageCount = await this.fetchWorkshopPageCount();
    let output = [];
    let promises = [];

    let pageMax = Math.floor((await this.fetchWorkshopPageCount()) / 100);
    for (let page = 1; page <= pageMax; page++) {
      promises.push(
        limit(async () => {
          if (global.isExiting()) return;

          console.log(`  Page: ${page}`);
          output.push(...(await this.fetchWorkshopPageItems(page)));
        })
      );
    }

    await Promise.all(promises);

    return output;
  }

  // Download to a file
  async download(url, dest) {
    const writer = fs.createWriteStream(dest);

    const response = await Axios({
      url,
      method: "GET",
      responseType: "stream",
    }).catch((error) => {
      if (e.response && e.response.status == 404) {
        throw new Error("404 URL: ${url}");
      }

      throw error;
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  }
}

module.exports = Api;
