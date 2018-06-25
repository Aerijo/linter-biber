module.exports = {
  /*
  * A map of all entry names to their (biblatex) supported fields
  *
  * String arrays are used for clarity (and performance; seriously, they beat out my regex tests)
  * A set could be used, but i don't think there is much of a performance gain.
  *
  * `required` and `optional` are mandatory, the others are optional.
  */
  entryFields: new Map([
      ["article", {
        required: ["author", "title", "journaltitle"],
        requiredChoice: [["year", "date"]],
        optional: ["translator", "annotator", "commentator", "subtitle", "titleaddon", "editor", "editora", "editorb", "editorc", "journalsubtitle", "issuetitle", "issuesubtitle", "language", "origlanguage", "series", "volume", "number", "eid", "issue", "month", "pages", "version", "note", "issn", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["book", {
        required: ["author", "title"],
        requiredChoice: [["year", "date"]],
        optional: ["editor", "editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "language", "origlanguage", "volume", "part", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "chapter", "pages", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["mvbook", {
        required: ["author", "title"],
        requiredChoice: [["year", "date"]],
        optional: ["editor", "editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "language", "origlanguage", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["inbook", {
        required: ["author", "title", "booktitle"],
        requiredChoice: [["year", "date"]],
        optional: ["bookauthor", "editor", "editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "booksubtitle", "booktitleaddon", "language", "origlanguage", "volume", "part", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "chapter", "pages", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["bookinbook", { // same as inbook
        required: ["author", "title", "booktitle"],
        requiredChoice: [["year", "date"]],
        optional: ["bookauthor", "editor", "editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "booksubtitle", "booktitleaddon", "language", "origlanguage", "volume", "part", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "chapter", "pages", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["suppbook", { // same as inbook
        required: ["author", "title", "booktitle"],
        requiredChoice: [["year", "date"]],
        optional: ["bookauthor", "editor", "editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "booksubtitle", "booktitleaddon", "language", "origlanguage", "volume", "part", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "chapter", "pages", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["booklet", {
        required: ["title"],
        requiredChoice: [["year", "date"], ["author", "editor"]],
        optional: ["subtitle", "titleaddon", "language", "howpublished", "type", "note", "location", "chapter", "pages", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["collection", {
        required: ["editor", "title"],
        requiredChoice: [["year", "date"]],
        optional: ["editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "language", "origlanguage", "volume", "part", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "chapter", "pages", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["mvcollection", {
        required: ["editor", "title"],
        requiredChoice: [["year", "date"]],
        optional: ["editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "language", "origlanguage", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["incollection", {
        required: ["author", "title", "booktitle"],
        requiredChoice: [["year", "date"]],
        optional: ["editor", "editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "booksubtitle", "booktitleaddon", "language", "origlanguage", "volume", "part", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "chapter", "pages", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["suppcollection", { // same as incollection
        required: ["author", "title", "booktitle"],
        requiredChoice: [["year", "date"]],
        optional: ["editor", "editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "booksubtitle", "booktitleaddon", "language", "origlanguage", "volume", "part", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "chapter", "pages", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["manual", {
        required: ["title"],
        requiredChoice: [["year", "date"]],
        optional: ["subtitle", "titleaddon", "language", "edition", "type", "series", "number", "version", "note", "organization", "publisher", "location", "isbn", "chapter", "pages", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"],
        optionalChoice: [["author", "editor"]]
      }],
      ["misc", {
        required: ["title"],
        requiredChoice: [],
        optional: ["subtitle", "titleaddon", "language", "howpublished", "type", "version", "note", "organization", "location", "date", "month", "year", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"],
        optionalChoice: [["author", "editor"], ["year", "date"]]
      }],
      ["online", {
        required: ["title"],
        requiredChoice: [],
        optional: ["subtitle", "titleaddon", "language", "version", "note", "organization", "date", "month", "year", "addendum", "pubstate", "urldat"],
        optionalChoice: [["author", "editor"], ["year", "date"]]
      }],
      ["patent", {
        required: ["author", "title", "number"],
        requiredChoice: [["year", "date"]],
        optional: ["holder", "subtitle", "titleaddon", "type", "version", "location", "note", "date", "month", "year", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["periodical", {
        required: ["title"],
        requiredChoice: [["year", "date"]],
        optional: ["editor", "editora", "editorb", "editorc", "subtitle", "issuetitle", "issuesubtitle", "language", "series", "volume", "number", "issue", "date", "month", "year", "note", "issn", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["suppperiodical", { // same as article
        required: ["author", "title", "journaltitle"],
        requiredChoice: [["year", "date"]],
        optional: ["translator", "annotator", "commentator", "subtitle", "titleaddon", "editor", "editora", "editorb", "editorc", "journalsubtitle", "issuetitle", "issuesubtitle", "language", "origlanguage", "series", "volume", "number", "eid", "issue", "month", "pages", "version", "note", "issn", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["proceedings", {
        required: ["title"],
        requiredChoice: [["year", "date"]],
        optional: ["editor", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "eventtitle", "eventtitleaddon", "eventdate", "venue", "language", "volume", "part", "volumes", "series", "number", "note", "organization", "publisher", "location", "month", "isbn", "chapter", "pages", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["mvproceedings", {
        required: ["title"],
        requiredChoice: [["year", "date"]],
        optional: ["editor", "subtitle", "titleaddon", "eventtitle", "eventtitleaddon", "eventdate", "venue", "language", "volumes", "series", "number", "note", "organization", "publisher", "location", "month", "isbn", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["inproceedings", {
        required: ["author", "title", "booktitle"],
        requiredChoice: [["year", "date"]],
        optional: ["editor", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "booksubtitle", "booktitleaddon", "eventtitle", "eventtitleaddon", "eventdate", "venue", "language", "volume", "part", "volumes", "series", "number", "note", "organization", "publisher", "location", "month", "isbn", "chapter", "pages", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["reference", { // same as collection
        required: ["editor", "title"],
        requiredChoice: [["year", "date"]],
        optional: ["editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "language", "origlanguage", "volume", "part", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "chapter", "pages", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["mvreference", { // same as mvcollection
        required: ["editor", "title"],
        requiredChoice: [["year", "date"]],
        optional: ["editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "language", "origlanguage", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["inreference", { // same as incollection
        required: ["author", "title", "booktitle"],
        requiredChoice: [["year", "date"]],
        optional: ["editor", "editora", "editorb", "editorc", "translator", "annotator", "commentator", "introduction", "foreword", "afterword", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "booksubtitle", "booktitleaddon", "language", "origlanguage", "volume", "part", "edition", "volumes", "series", "number", "note", "publisher", "location", "isbn", "chapter", "pages", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["report", {
        required: ["author", "title", "type", "institution"],
        requiredChoice: [["year", "date"]],
        optional: ["subtitle", "titleaddon", "language", "number", "version", "note", "location", "month", "isrn", "chapter", "pages", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["thesis", {
        required: ["author", "title", "type", "institution"],
        requiredChoice: [["year", "date"]],
        optional: ["subtitle", "titleaddon", "language", "note", "location", "month", "isbn", "chapter", "pages", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["unpublished", {
        required: ["author", "title"],
        requiredChoice: [["year", "date"]],
        optional: ["subtitle", "titleaddon", "type", "eventtitle", "eventtitleaddon", "eventdate", "venue", "language", "howpublished", "note", "location", "isbn", "date", "month", "year", "addendum", "pubstate", "url", "urldate"]
      }],
      ["conference", { // same as inproceedings (legacy)
        required: ["author", "title", "booktitle"],
        requiredChoice: [["year", "date"]],
        optional: ["editor", "subtitle", "titleaddon", "maintitle", "mainsubtitle", "maintitleaddon", "booksubtitle", "booktitleaddon", "eventtitle", "eventtitleaddon", "eventdate", "venue", "language", "volume", "part", "volumes", "series", "number", "note", "organization", "publisher", "location", "month", "isbn", "chapter", "pages", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["electronic", { // same as online (legacy)
        required: ["title"],
        requiredChoice: [],
        optional: ["subtitle", "titleaddon", "language", "version", "note", "organization", "date", "month", "year", "addendum", "pubstate", "urldat"],
        optionalChoice: [["author", "editor"], ["year", "date"]]
      }],
      ["mastersthesis", { // similar to thesis; type is now optional
        required: ["author", "title", "institution"],
        requiredChoice: [["year", "date"]],
        optional: ["type", "subtitle", "titleaddon", "language", "note", "location", "month", "isbn", "chapter", "pages", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["phdthesis", { // similar to thesis; type is now optional
        required: ["author", "title", "institution"],
        requiredChoice: [["year", "date"]],
        optional: ["type", "subtitle", "titleaddon", "language", "note", "location", "month", "isbn", "chapter", "pages", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["techreport", { // similar to report; type is now optional
        required: ["author", "title", "institution"],
        requiredChoice: [["year", "date"]],
        optional: ["type", "subtitle", "titleaddon", "language", "number", "version", "note", "location", "month", "isrn", "chapter", "pages", "pagetotal", "addendum", "pubstate", "doi", "eprint", "eprintclass", "eprinttype", "url", "urldate"]
      }],
      ["www", { // same as online (legacy; jurabib)
        required: ["title"],
        requiredChoice: [],
        optional: ["subtitle", "titleaddon", "language", "version", "note", "organization", "date", "month", "year", "addendum", "pubstate", "urldat"],
        optionalChoice: [["author", "editor"], ["year", "date"]]
      }]
  ]),

  /*
  * Map from alias -> biblatex supported
  */
  fieldAliases: new Map([
    ["address", "location"],
    ["annote", "annotation"],
    ["archiveprefix", "eprinttype"],
    ["journal", "journaltitle"],
    ["key", "sortkey"],
    ["pdf", "file"],
    ["primaryclass", "eprintclass"],
    ["school", "institution"]
  ]),

  /*
  * Entries with special properties that I don't want to mess with
  */
  ignoredEntries: new Set(["set", "xdata"]),

  /*
  * Entries explicity labelled unsupported by biblatex
  */
  unsupportedEntries: new Set(["artwork", "audio", "bibnote", "commentary", "image", "jurisdiction", "legislation", "legal", "letter", "movie", "music", "performance", "review", "software", "standard", "video"]),

  /*
  * Fields that can appear anywhere
  */
  specialFields: new Set(["crossref", "entryset", "execute", "gender", "langid", "hyphenation", "langidopts", "ids", "indexsorttitle", "keywords", "options", "presort", "related", "relatedoptions", "relatedtype", "relatedstring", "sortkey", "sortname", "sortshorthand", "sorttitle", "sortyear", "xdata", "xref"])

};
