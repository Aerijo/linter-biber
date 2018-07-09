module.exports = class Field {
  constructor(name, props={}) {
    this.name = name;
    this.type = props.type || null;
    this.format = props.format || null;
    this.datatype = props.datatype || null;
    this.nullok = props.nullok || false;
    this.skipout = props.skipout || false;
    this.label = props.label || false;

    // NOTE: These properties are only used if constrained.
    // I'm adding them anyway so all field instances are uniform
    this.rangemin = props.rangemin;
    this.rangemax = props.rangemax;
    this.pattern = props.pattern;

    if (props.pattern) {
      const regexSource = /\\regexp{/.test(props.pattern)
        ? props.pattern.replace(/\\regexp\{(.*)\}/, "$1")
        : props.pattern;
      this.pattern = new RegExp(regexSource);
    }
  }

  addConstraint(constraint) {
    const props = constraint.value.properties;
    const keys = Object.keys(props);
    keys.forEach(key => {
      switch (key) {
        case "type":
        break;
        case "pattern":
        const regexSource = /\\regexp{/.test(props.pattern)
          ? props.pattern.replace(/\\regexp\{(.*)\}/, "$1")
          : props.pattern;
        this.pattern = new RegExp(regexSource);
        break;
        default:
        this[key] = props[key];
      }
    });
  }

  /*
  * @param {string} The evaluated value of the field
  * @param {string} The identified type of value (e.g., string, number)
  * @returns {(null|{Object})} If no issue, then null. Otherwise, the lint details.
  */
  checkConstraints(value, type=null) {
    // the value has already been evaluated to it's final form, and
    // we don't call this if the evaluation was unsuccessful.
    switch (this.type) {
      case "list":
      switch (this.datatype) {
        case "literal":
        break;
        case "name":
        break;
        case "key":
        break;
      }
      break;
      case "field":
      switch (this.datatype) {
        case "literal":
        break;
        case "range":
        if (!/^[^\-]*\-+[^\-]*$/.test(value)) {
          return { severity: "warning", msg: "W065 - Invalid range format" };
        }
        break;
        case "integer": // NOTE: integers not actually required
        break;
        case "datepart":
        break;
        case "date":
        if (!validDateFormat(value)) {
          return {
            severity: "warning",
            msg: "W067 - Invalid date format",
            detail: "Expected (a subset of) yyyy-mm-ddThh:nn[+-][hh[:nn]Z].\
            Optionally add an end date separated from the start with / "
          };
        }
        break;
        case "verbatim":
        break;
        case "uri":
        break;
        case "keyword":
        break;
        case "options":
        break;
        case "pattern":
        if (!this.pattern.test(value)) {
          return { severity: "warning", msg: "W068 - Invalid pattern match" };
        }
        break;
        case "key":
        break;
        case "code":
        break;
      }
    }
    return null;
  }
};



function validDateFormat(date) {
  date = date.trim();
  if (date === "..") { return true; } // ISO8601-2 4.4 (open date)

  const dateSepRegex = /^([^\/]+)?\/?([^\/]+)?$/;
  let match = date.match(dateSepRegex);
  if (!match) { return false; }

  let [_, startDate, endDate] = match;

  if (!startDate) { return false; }

  let isUnspecified = startDate.includes("X");
  if (isUnspecified && endDate !== undefined) {
    return false; // biblatex will ignore the end date, so we'll treat it like it's invalid
  }

  if (isUnspecified) {
    return parse_unspecified_date(startDate);
  }

  return parse_date(startDate) && (endDate ? parse_date(endDate) : true);
}

// This function replicates the process biblatex follows to parse dates
/*
https://github.com/plk/biber/blob/40ac98397a8fb89cef0fd444d0342ca2f893ffd4/lib/Biber/
Utils.pm#L1046
*/
function parse_date(date) {
  if (typeof date !== "string") { return false; }
  return null !== date
    .replace(/^\s*(.+?)\s*\%?\s*\~?\s*\??\s*$/, "$1") // strip end %, ~, ?
    .replace(/(?:Z|[+-]\d\d:\d\d)$/, "") // strip end Z OR +12:34
    .replace(/^(-?\d{4})-2[1234]$/, "$1") // strip end seasons
    .match(/^(?:\-?\d{4}(?:\-\d\d(?:\-\d\d(?:T\d\d:\d\d:\d\d)?)?)?|Y\-?\d{5,})$/);
}

function parse_unspecified_date(date) {
  return /^(\d{3}X|\d{2}XX|\d{1}XXX|\d{4}\-(?:XX|\d{2}\-XX|XX\-XX))$/.test(date);
}
