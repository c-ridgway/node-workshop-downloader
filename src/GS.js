const AsyncEventEmitter = require("asynchronous-emitter");

//
class GS {
  constructor() {
    this._functs = null;
    this._exiting = false;
    this.events = null;
    this._started = false;

    this.clear();
  }

  static create() {
    const instance = new GS();

    process.on("SIGTERM", (...args) => instance.exit(...args));
    process.on("SIGINT", (...args) => instance.exit(...args));
    global.isExiting = () => instance.isExiting();

    return instance;
  }

  clear() {
    this.events = new AsyncEventEmitter();
    this._functs = [];
    this.prepend(() => this.events.emit("free"));
    this._setStarted(false);
  }

  append(funct) {
    this._functs.push(funct);
  }

  prepend(funct) {
    this._functs.unshift(funct);
  }

  async start() {
    await this.events.emit("start");
    this._setStarted(true);
    await this.events.emit("started");
    await this.events.emit("main");
  }

  async free() {
    if (this.isExiting()) return false; // If already freeing

    if (!this.isStarted()) {
      // If app hasn't fully initialised
      await new Promise((resolve, reject) => {
        this.events.once("started", () => resolve());
      });
    }

    this._setExiting(true);

    for (const funct of this._functs) {
      try {
        let result = funct();
        if (Promise.resolve(result) == result)
          // Promise
          result = await result;

        if (result === true)
          // Exit where it is if returned true
          break;
      } catch (error) {
        console.log(error);
      }
    }

    this.clear();
    this._setExiting(false);

    return true;
  }

  isExiting() {
    return this._exiting;
  }

  isStarted() {
    return this._started;
  }

  async exit(code) {
    if (!(await this.free())) return;

    process.exit(0);
  }

  //
  _setExiting(value) {
    this._exiting = value;
  }

  _setStarted(value) {
    this._started = value;
  }
}

module.exports = GS;
