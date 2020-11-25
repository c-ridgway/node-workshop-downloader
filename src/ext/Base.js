const EventEmitter = require("events");

class Base {
  constructor() {
    this._locked = 0;
    this.events = new EventEmitter();
  }

  static create(...args) {
    const instance = new this(...args);
    return instance;
  }

  init() {
    const time = Date.now();
    return this._init().then(() => {
      console.log(`Info: Loaded ${this.constructor.name} ${Date.now() - time}ms`);
    });
  }

  async free() {
    const time = Date.now();

    // Wait until unlocked
    await new Promise((resolve, reject) => {
      if (this.isLocked()) {
        this.events.once("unlocked", () => resolve());
      } else resolve();
    });

    // Free data
    await this._free().then(() => {
      console.log(`Info: Freed ${this.constructor.name} ${Date.now() - time}ms`);
    });
  }

  lock() {
    this._locked++;
  }

  unlock() {
    if (--this._locked <= 0) {
      this._locked = 0;
      this.events.emit("unlocked");
    }
  }

  isLocked() {
    return this._locked;
  }

  _init() {
    throw new Error(`Undefined '_init' in ${this.constructor.name}`);
  }

  _free() {
    throw new Error(`Undefined '_free' in ${this.constructor.name}`);
  }
}

module.exports = Base;
