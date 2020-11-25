const AsyncEventEmitter = require("asynchronous-emitter");

//
class GS {
  constructor() {
    this.__isExiting = false;
    this.__isFreeing = false;
    this.__hasInit = false;

    this.events = null;
    this.__functs = null;
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
    this.__functs = [];

    this.prepend(() => this.events.emit("free"));
    this._setHasInit(false);
  }

  append(funct) {
    this.__functs.push(funct);
  }

  prepend(funct) {
    this.__functs.unshift(funct);
  }

  async main() {
    await this.events.emit("pre_init");
    await this.events.emit("init");
    this._setHasInit(true);
    await this.events.emit("post_init");
    await this.events.emit("main");
  }

  async free() {
    if (!this.hasInit()) {
      // If app hasn't fully initialised, wait
      await new Promise((resolve, reject) => {
        this.events.once("post_init", () => resolve());
      });
    }

    this._setIsFreeing(true);

    for (const funct of this.__functs) {
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
    this._setIsFreeing(false);
  }

  isExiting() {
    return this.__isExiting;
  }

  isFreeing() {
    return this.__isFreeing;
  }

  hasInit() {
    return this.__hasInit;
  }

  async exit(code) {
    if (this.isExiting()) return; // If already freeing

    this._setIsExiting(true);
    await this.free();

    process.exit();
  }

  //
  _setIsExiting(value) {
    this.__isExiting = value;
  }

  _setIsFreeing(value) {
    this.__isFreeing = value;
  }

  _setHasInit(value) {
    this.__hasInit = value;
  }
}

module.exports = GS;
