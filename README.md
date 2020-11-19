# node-workshop-downloader

Downloads every public workshop item from the Steam workshop, intended for backups.

## Config

### Get steam API key

- The steam query limit is currently 100,000 requests per day.
  https://steamcommunity.com/dev/apikey

### Game id

- Visit the workshop page, in the url bar it will contain an 'appid'
- The below example shows '4920' as the id, which is for Natural Selection 2:
  https://steamcommunity.com/workshop/browse/?appid=4920

### Install

1. Install git and nodejs.
2. Pase in cmd/terminal:
   `git clone https://github.com/c-ridgway/node-workshop-downloader.git &&cd node-workshop-downloader`
3. Download all dependencies:
   `npm install`
4. Add your steam API key to `config.json`, change the game id if you're wanting to backup something other than Natural Selection 2.
5. Open `run.bat` for Windows and `run.sh` for Linux.

### Disclamar

- Please ensure you have enough free space before you begin. In the future I will check the available free space before the downloading begins, based on the workshop estimations.
- Do not increase `steam_concurrency` to something crazy, otherwise you may exceed some sort of query rate limit or increase the chances of transport failure.
- For games with a lot of mods 5000+, ensure to set `steam_api_sleep_ms`, as this will provide a delay between steam api page queries.
