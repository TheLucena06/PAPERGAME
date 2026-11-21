/* extras.js - hooks for optional extras that aren't part of the public build. */
const ExtrasMixin = {
  extrasRunStart() {},
  extrasBossId(id) { return id; },
  updateExtras() {}
};
