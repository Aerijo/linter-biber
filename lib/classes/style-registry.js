const styleMetaData = require("../cite_styles/meta/meta.json");

const templatesPath = "../cite_styles/templates";

module.exports = class StyleRegistry {
  constructor() {
    this.styles = new Map();
  }
};
