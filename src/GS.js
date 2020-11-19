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

    return instance;
  }

  clear() {
    this.events = new AsyncEventEmitter();
    this._functs = [];
    this.prepend(() => this.events.emit("free"));
    this._started = false;
  }

  append(funct) {
    this._functs.push(funct);
  }

  prepend(funct) {
    this._functs.unshift(funct);
  }

  async start() {
    await this.events.emit("start");
    this._started = true;
  }

  async free() {
    if (!this._started) return true; // If app hasn't fully initialised
    if (this._exiting) return false; // If already closed

    this._exiting = true;

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
    this._exiting = false;

    return true;
  }

  async exit(code) {
    if (!(await this.free())) return;

    process.exit(0);
  }
}

//const instance = new GS();
//process.on("SIGTERM", (...args) => instance.exit(...args));
//process.on("SIGINT", (...args) => instance.exit(...args));
//process.on('SIGUSR2', (...args) => console.log(22));

//module.exports = instance;

module.exports = GS;
