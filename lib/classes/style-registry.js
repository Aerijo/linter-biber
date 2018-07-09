const styleMetaData = require("../cite_styles/meta/meta.json");
const Style = require("./style.js");
const ProtoStyle = require("./protostyle.js");
// const Template = require("./template.js");

module.exports = class StyleRegistry {
  constructor() {
    this.templatesPath = "../cite_styles/templates";
    this.templates = new Map();
    this.protoStyles = new Map();
    this.styles = new Map();
    this.defaultTemplate = require(`${this.templatesPath}/default_datamodel.json`);
    this.defaultProtoStyle = new ProtoStyle(this.defaultTemplate);
    this.defaultStyle = new Style("default", this.defaultProtoStyle);
    this.metaData = styleMetaData;
  }
  
  getDefaultStyle() {
    return this.defaultStyle;
  }

  getStyle(name) {
    if (!this.styles.has(name)) {
      const style = this.addStyle(name);
      if (style === null) {
        return null;
      } else {
        return style;
      }
    }
    return this.styles.get(name);
  }

  addStyle(name) {
    let protoStyle;
    if (!this.protoStyles.has(name)) {
      protoStyle = this.addProtoStyle(name);
      if (protoStyle === null) { return null; }
    } else {
      protoStyle = this.protoStyles.get(name);
    }

    const style = new Style(name, protoStyle);
    this.styles.set(name, style);

    return style;
  }

  addProtoStyle(name, withDefaultTemplate=true) {
    let template;
    if (!this.templates.has(name)) {
      try {
        template = require(`${this.templatesPath}/${name}.json`);
        this.templates.set(name, template);
      } catch (e) {
        console.error(e);
        return null;
      }
    } else {
      template = this.templates.get(name);
    }

    const templates = withDefaultTemplate ? [this.defaultTemplate, template] : [template];
    const protoStyle = new ProtoStyle(templates);

    this.protoStyles.set(name, protoStyle);
    return protoStyle;
  }
};
