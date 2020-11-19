class Base {
  static create(...args) {
    const instance = new this(...args);
    return instance;
  }

  start() {
    console.log(`Info: Loading ${this.constructor.name}`);
  }

  free() {
    console.log(`Info: Freeing ${this.constructor.name}`);
  }
}

module.exports = Base;
