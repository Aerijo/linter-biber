const { constructStyleFromJSON, getDefaultStyle } = require("./style-classes.js");

/*
* This class deals with providing expected entry
* and field data to the linter.
*/
module.exports = class StyleRegistry {
  constructor() {
    const defaultStyle = getDefaultStyle();
    this.externalStylesProperties = this.getExternalStylesProperties();
    this.loadedStyles = new Map([["default", defaultStyle]]);
    this.activeStyleName = "default";
    this.activeStyle = defaultStyle;
  }

  /*
  * Pulls the JSON of possible (CTAN listed) citation
  * styles, and turns it into something usable
  */
  getExternalStylesProperties() {
    // const citationStyleProps = require("./cite-styles/meta/meta.json");

    // return citationStyleProps;
    return {};
  }

  setActiveStyle(styleName) {
    this.activeStyle = this.citationStyles.get(styleName);
    this.activeStyleName = styleName;
  }

  loadStyle(pathToJSON) {
    const styleData = require(pathToJSON);
    return constructStyleFromJSON(styleData);
  }

  mergeStyles(main, additional) {
    return main.mergeWith(additional);
  }

  mergeWithDefault(main) {
    return main.mergeWith(this.loadedStyles.get("default"));
  }

  /*
  * This is passed a map of entry names, where the value
  * is an object with (1) the frequency of the entry,
  * (2) an array of the fields in the entry.
  *
  * First, we scan the file for user directives. If there's
  * a match, we use it. NOTE: the scan can be extended to the
  * project files, specifically the root and config files.
  *
  * If unsucessful, we then compare the given entries map,
  * starting at the most frequent entry, to find the style
  * that matches closest. If there are only default fields,
  * we can just assume no external style is being used. If
  * we reduce to one possible style, we assume it's in use.
  * If we reduce to multiple possibilities, then we go with
  * the "first" one.
  *
  * IMPROVEMENT: Maybe, if it cannot be conclusively detected,
  * notify the user and ask?
  */
  // determineCitationStyleName(entries, bibFilePath) {
  //   const style = "apa";
  //   return style;
  // }

  /*
  * Called after all fields have been individually parsed. Used
  * to ensure that the required fields are all present, and as
  * much complicated behaviour with constraints as possible is
  * satisfied
  *
  * entry: string
  * fields: MAP name (string) -> value (string)
  */
  validateEntryFields(entry, fields) {
    return true;
  }

  getActiveStyle() {
    return this.activeStyle;
  }
};
