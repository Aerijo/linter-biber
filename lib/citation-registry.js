const prebuiltDefault = require("./cite_styles/default.js");

const { Style, Entry, Field, Constraint } = require("./citation-classes.js");

/*
* This class deals with providing expected entry
* and field data to the linter.
*/
module.exports = class CitationRegistry {
  constructor() {
    this.citationStyles = this.gatherCitationStyles();
    this.activeStyleName = "default";
    this.activeStyle = prebuiltDefault;

    this.setActiveStyle(prebuiltDefault);
  }

  /*
  * Pulls the JSON of possible (CTAN listed) citation
  * styles, and turns it into something usable
  */
  gatherCitationStyles() {
    let citationStyles = new Map([["default", prebuiltDefault]]);

    return citationStyles;
  }

  setActiveStyle(styleName) {
    this.activeStyle = this.citationStyles.get(styleName);
    this.activeStyleName = styleName;
  }

  buildActiveStyle() {
    if (!this.activeStyleName) {
      this.activeStyle = prebuiltDefault;
      return prebuiltDefault;
    }

    const externalStyle = this.citationStyles.get(this.externalStyleName);
    if (!externalStyle) {
      console.error("missing external style", this.externalStyleName);
      return;
    }

    externalStyle.standAlone
      ? this.activeStyle = externalStyle
      : this.activeStyle = this.mergeStyles(externalStyle, prebuiltDefault);

    return this.activeStyle;
  }

  mergeStyles(main, additional) {
    return main.mergeWith(additional);
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
  determineCitationStyleName(entries, bibFilePath) {
    const style = "apa";
    return style;
  }

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
