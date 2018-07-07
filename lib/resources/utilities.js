const fs = require("fs");
const path = require("path");
const util = require("util");

function readdir(dirPath) {
  return new Promise((resolve, reject) => {
    fs.readdir(dirPath, (err, children) => resolve(children));
  });
}

function getStats(somePath) {
  return new Promise((resolve, reject) => {
    fs.stat(somePath, (err, stats) => resolve(stats));
  });
}

function readFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf-8", (err, contents) => {
      if (err) {
        reject(err);
      } else {
        resolve(contents);
      }
    });
  });
}

async function findFilesByExtension(dirPath, ext, acc=[]) {
  let children;
  try {
    children = await readdir(dirPath);
  } catch (e) {
    console.error(e);
    return acc;
  }

  for (let i = 0; i < children.length; i++) {
    let child = children[i];
    let absFilePath = path.join(dirPath, child);
    let stats = await getStats(absFilePath);
    if (!stats) { console.log("ERR: ", absFilePath); continue; }
    if (stats.isDirectory()) {
      await findFilesByExtension(absFilePath, ext, acc);
    } else if (path.extname(child) === ext) {
      acc.push(absFilePath);
    }
  }
  return acc;
}

function serialise(input) {
  if (input instanceof Map) {
    let mapObj = {};
    input.forEach((value, key) => mapObj[key] = serialise(value));
    return mapObj;
  } else if (input instanceof Set) {
    let setArray = [];
    input.forEach(value => setArray.push(serialise(value)));
    return setArray;
  } else if (input instanceof Array) {
    return input.map(value => serialise(value));
  } else if (input instanceof Object) {
    let keys = Object.keys(input);
    let newObject = {};
    keys.forEach(key => {
      let oldValue = input[key];
      newObject[key] = serialise(oldValue);
    });
    return newObject;
  } else {
    return input;
  }
}

function stripComments(text) {
  const READING = 0;
  const COMMENT = 1;

  let processedStrings = [];
  let commentStartIndex = 0;
  let lastCommentEndIndex = 0;

  let state = READING;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    switch (state) {
      case READING:
        if (char === "%") {
          processedStrings.push(text.slice(lastCommentEndIndex, i));
          commentStartIndex = i;
          state = COMMENT;
        } else if (char === "\\") {
          i++; // skip next char // not strictly correct, but works for escaped %
        }
        break;
      case COMMENT:
        if (char === "\n") {
          lastCommentEndIndex = i + 1;
          state = READING;
        }
        break;
    }
  }

  processedStrings.push(text.slice(lastCommentEndIndex));
  return processedStrings.join("");
}

function CSVtoArray(csv) {
  if (csv === null) { return null; }
  return csv
    .trim() // remove outer whitespace
    .split(/\s*,\s*/) // split values
    .filter(value => value.length > 0); // remove empty values
}

function getParameterOptions(text) {
  const options = {};
  const optionPairs = CSVtoArray(text).map(value => value.split(/\s*=\s*/));
  optionPairs.forEach(([key, value]) => {
    if (value === "false") {
      options[key] = false;
    } else if (value === "true") {
      options[key] = true;
    } else if (typeof value === "undefined") {
      options[key] = true;
    } else {
      options[key] = value;
    }
  });

  return options;
}

function tokeniseText(text) {
  const tokens = [];
  let index = 0;
  while (true) {
    const command = getNextCommand(text, index);
    if (command === null) { break; }

    let gap = text.slice(index, command.startIndex);
    let gapText = gap && gap.trim();
    if (gapText !== "") {
      tokens.push({ type: "text", body: gapText });
    }

    index = command.endIndex;
    tokens.push({
      type: "command",
      name: command.name,
      options: command.options,
      body: command.body || null,
      tokenisedBody: command.body ? tokeniseText(command.body) : null
    });
  }

  let trailingText = text.slice(index) && text.slice(index).trim();
  if (trailingText !== "") {
    tokens.push({ type: "text", body: trailingText });
  }

  return tokens;
}

function getNextCommand(text, index=0) {
  const commandRegex = /\\([a-zA-Z]+)\s*/g;
  const optionsRegex = /\[([^\]]*)\]\s*/g;

  commandRegex.lastIndex = index;
  const commandMatch = commandRegex.exec(text);

  if (commandMatch === null) { return null; }

  const name = commandMatch[1];
  let bodyStartIndex = commandRegex.lastIndex;

  let options = null;
  if (text.charAt(bodyStartIndex) === "[") {
    optionsRegex.lastIndex = bodyStartIndex;
    const optionsMatch = optionsRegex.exec(text);

    options = optionsMatch[1];
    bodyStartIndex = optionsRegex.lastIndex;
  }

  let bodyData = gatherBody(text, bodyStartIndex);
  let body = null;
  if (bodyData) {
    index = bodyData.index;
    body = bodyData.value;
  }

  return {
    name,
    options,
    body,
    startIndex: commandMatch.index,
    endIndex: index
  };
}

function gatherBody(text, startIndex) {
  if (text.charAt(startIndex) !== "{") { return null; }

  let braceCount = 1;

  for (let i = startIndex + 1; i < text.length; i++) {
    switch (text.charAt(i)) {
      case "{":
        braceCount += 1;
        break;
      case "}":
        braceCount -= 1;
        if (braceCount === 0) {
          return {
            value: text.slice(startIndex + 1, i),
            index: i + 1
          };
        }
        break;
      case "\\":
        i++; // skip next char
    }
  }

  console.warn("unfinished command body!");
  return {
    value: text.slice(startIndex + 1),
    index: text.length
  };
}

function isEmptyStyleProperties(c) { // [] == false
  return !(c.constants ||
    c.entries ||
    c.fields ||
    c.entryFields ||
    c.universalFields ||
    c.constraints ||
    c.universalConstraints ||
    c.resetPriorEntries ||
    c.resetPriorFields ||
    c.resetPriorEntryFields ||
    c.resetPriorConstraints);
}

module.exports = {
  readdir,
  getStats,
  readFile,
  findFilesByExtension,
  serialise,
  stripComments,
  CSVtoArray,
  tokeniseText,
  getParameterOptions,
  isEmptyStyleProperties
};
