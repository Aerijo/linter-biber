/*
* This class deals with providing expected entry
* and field data to the linter.
*/
module.exports = class CitationRegistry {
  constructor() {
    this.citationStyles = this.gatherCitationStyles();
  }

  /*
  * Pulls the JSON of possible (CTAN listed) citation
  * styles, and turns it into something usable
  */
  gatherCitationStyles() {

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
  determineCitationStyle(entries, bibFilePath) {
    return null;
  }


  /*
  * Makes an object with the necessary maps for the linter to
  * use when determining if fields and entries are expected.
  */
  generateExpectedCitations() {
    const citationStyles = {
      entries: new Map(),
      specialFields: new Set()
    };
  }

  /*
  * Called after all fields have been individually parsed. Used
  * to ensure that the required fields are all present, and as
  * much complicated behaviour with constraints as possible is
  * satisfied
  */
  validateEntryFields(entry, fields) {
    return true;
  }

  getExpectedEntries() {
    const entryMap = new Map();

    let entryProperties = {
      isAlias: false,
      aliasName: null,
      expectedFields: new Map([{
        isAlias: false,
        aliasName: null,
        type: null
      }]),
      constraints: new Set()
    };

    entryMap.set("foo", entryProperties);

    return entryMap;
  }
};
