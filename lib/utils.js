module.exports = {
  validDateFormat(date) {
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
  },

  isExpectedField(field, expected) {
    return expected.required.includes(field) ||
    expected.optional.includes(field) ||
    (expected.requiredChoice && nestedStringsIncludes(field, expected.requiredChoice)) ||
    (expected.optionalChoice && nestedStringsIncludes(field, expected.optionalChoice));
  },

  unseenRequiredFields(seen, expected) {
    missing = [];
    expected.required.forEach(field => {
      if (!seen.has(field)) { missing.push(field); }
    });

    if (!expected.requiredChoice) { return missing; }

    expected.requiredChoice.forEach(fieldArray => {
      let found = false;
      for (let i = 0; i < fieldArray.length; i++) {
        if (seen.has(fieldArray[i])) {
          found = true;
          break;
        }
      }
      if (!found) { missing.push(`[${fieldArray}]`); }
    });

    return missing;
  }
};

// This function replicates the process biblatex follows to parse dates
// https://github.com/plk/biber/blob/40ac98397a8fb89cef0fd444d0342ca2f893ffd4/lib/Biber/Utils.pm#L1046
function parse_date(date) {
  if (typeof date !== "string") { return false; }
  return null !== date
    .replace(/^\s*(.+?)\s*\%?\s*\~?\s*\??\s*$/, "$1") // strip end %, ~, ?
    .replace(/(?:Z|[+-]\d\d:\d\d)$/, "") // strip end Z OR +12:34
    .replace(/^(-?\d{4})-2[1234]$/, "$1") // strip end seasons
    .match(/^(?:-?\d{4}(?:\-\d\d(?:\-\d\d(?:T\d\d:\d\d:\d\d)?)?)?|Y-?\d{5,})$/); // match what remains
}

function parse_unspecified_date(date) {
  return /^(\d{3}X|\d{2}XX|\d{1}XXX|\d{4}\-(?:XX|\d{2}\-XX|XX\-XX))$/.test(date);
}

function nestedStringsIncludes(value, nests) {
  for (let i = 0; i < nests.length; i++) {
    if (nests[i].includes(value)) { return true; }
  }
  return false;
}
