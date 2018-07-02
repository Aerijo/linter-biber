const fs = require("fs");
const path = require("path");

const packagesPath = "/usr/local/texlive/2018/texmf-dist/tex/latex";

module.exports = { };

/*
* DISCLAIMER: I have no idea what I'm doing. :)
*
* Seriously though, right now I'm only "parsing" the dbx file. I have no idea
* what it does, and what bbx, cbx, etc., do. AFAIK it seems to be the only one
* responsible for initialising new entries and fields for a style.
*
* Of note is that MLA does not have any dbx files (that I can find). So I guess
* they just stick with the default entries/fields ? APA has one, and I aim to
* support APA at the very least.
*
*/

if (require.main === module) {
  main();
}

async function main() {
  let bibDataFiles = await findFilesByExtension(packagesPath, ".dbx");

  let styleDefinitions = new Map();

  for (let i = 0; i < bibDataFiles.length; i++) {
    let file = bibDataFiles[i];
    let bibData;
    try {
      bibData = await getStyleDef(file);
    } catch (e) {
      console.error(e);
      continue;
    }

    let fileName = path.basename(file, ".dbx");
    if (styleDefinitions.has(fileName)) {
      console.error("duplicate file names!", fileName);
      console.log(file);
      continue;
    }

    bibData.filePath = file;
    styleDefinitions.set(fileName, bibData);

  }

  let printReady = JSON.stringify(convertMaps(styleDefinitions), null, 2);

  fs.writeFile("result.json", printReady, { encoding: "utf-8" }, () => { console.log("done"); });
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

async function getStyleDef(filePath) {
  // console.log("\n\n*****", filePath);
  let commands = await gatherStyleCommands(filePath);
  let parsedCommands = parseStyleCommands(commands);
  return parsedCommands;
}

async function gatherStyleCommands(filePath) {
  let text = await readFile(filePath);
  text = stripComments(text);

  const gatheredCommands = [];

  const commandStartRegex = /\\DeclareDatamodel([a-zA-Z0-9]*)\s*/g;
  const optionsRegex = /\[([^\]]*)\]\s*/g;

  let match;
  do {
    match = commandStartRegex.exec(text);
    if (!match) { break; }

    let bodyStartIndex = commandStartRegex.lastIndex;
    optionsRegex.lastIndex = commandStartRegex.lastIndex;

    let command = {
      type: match[1],
      options: null,
      body: null
    };

    if (text.charAt(bodyStartIndex) === "[") {
      let optionsMatch = optionsRegex.exec(text);
      command.options = optionsMatch[1];
      bodyStartIndex = optionsRegex.lastIndex;
    }

    let bodyText = gatherBody(text, bodyStartIndex);
    if (bodyText) {
      command.body = bodyText;
      gatheredCommands.push(command);
    } else {
      console.error(`Missing body!\n*File: ${filePath}\n*Index: ${bodyStartIndex}`);
      continue;
    }
  } while (match);

  return gatheredCommands;
}

function gatherBody(text, startIndex) {
  if (text.charAt(startIndex) !== "{") { return false; }

  let braceCount = 1;

  for (let i = startIndex + 1; i < text.length; i++) {
    switch (text.charAt(i)) {
      case "{":
        braceCount += 1;
        break;
      case "}":
        braceCount -= 1;
        if (braceCount === 0) { return text.slice(startIndex + 1, i); }
        break;
      case "\\":
        i++; // skip next char
    }
  }

  console.error("closing brace not detected!");
  return false; // unfinished braces (probably error)
}

function parseStyleCommands(commands) {
  let parsedCommands = {
    entries: new Set(),
    entryConstraints: new Map(),
    entryFields: new Map(), // if entry is in default biblatex, then fields are in addition to defaults
    specialFields: new Set(), // for fields not tied to a set of entries
    fieldTypes: new Map(),
    constants: new Map()
  };

  for (let i = 0; i < commands.length; i++) {
    let command = commands[i];
    switch (command.type) {
      case "Constant":
        addConstants(command, parsedCommands);
        break;
      case "Entrytypes":
        addEntryTypes(command, parsedCommands);
        break;
      case "Fields":
        addFieldTypes(command, parsedCommands);
        break;
      case "Entryfields":
        addEntryFields(command, parsedCommands);
        break;
      case "Constraints":
        addConstraints(command, parsedCommands);
        break;
    }
  }

  return parsedCommands;
}

function addConstants(command, parsedCommands) {
  return;
}

function addConstraints(command, parsedCommands) {
  return;
}

function texCSVtoArray(csv) {
  return csv
    // .replace(/%[^\n]*\n/g, "") // remove comments // already done when read in
    .trim() // remove outer whitespace
    .split(/\s*,\s*/) // split values
    .filter(value => value.length > 0); // remove empty values
}

function addEntryTypes(command, parsedCommands) {
  // options don't seem to be used for this one, so we'll ignore them and add a warning if they ever show up
  if (command.options !== null) { console.warn("non empty options!"); }
  texCSVtoArray(command.body).forEach(entry => parsedCommands.entries.add(entry));
}

function addEntryFields(command, parsedCommands) {
  const fields = texCSVtoArray(command.body);
  const validEntries = command.options !== null ? texCSVtoArray(command.options) : [];

  if (validEntries.length === 0) {
    fields.forEach(field => parsedCommands.specialFields.add(field));
  } else {
    validEntries.forEach(entry => {
      if (parsedCommands.entryFields.has(entry)) {
        const fieldsForEntry = parsedCommands.entryFields.get(entry);
        fields.forEach(field => fieldsForEntry.add(field));
      } else {
        parsedCommands.entryFields.set(entry, new Set(fields));
      }
    });
  }
}

function addFieldTypes(command, parsedCommands) {
  const fieldParseRegex = /^\s*([^\s=]+)\s*(?:=?\s*([^\s=]+))?\s*$/;
  const fieldProperties = {
    type: null,
    format: null,
    datatype: null,
    nullok: false,
    skipout: false,
    label: false,
  };

  if (command.options === null) { console.warn("Options should not be null!", "\ncommand: ", command); return; }

  let properties = texCSVtoArray(command.options);

  properties.forEach(fieldProp => {
    let match = fieldProp.match(fieldParseRegex);
    if (match === null) { console.warn("Possibly invalid field type option!", "\ncommand: ", command); return; }

    let [_, identifier, value] = match;

    switch (identifier) {
      case "type":
        if (value === undefined) { console.warn("Undefined type!", "\ncommand: ", command, "\nmatch: ", match); return; }
        fieldProperties.type = value;
        break;
      case "format":
        fieldProperties.format = value; // not required
        break;
      case "datatype":
        if (value === undefined) { console.warn("Undefined datatype!", "\ncommand: ", command, "\nmatch: ", match); return; }
        fieldProperties.datatype = value;
        break;
      case "nullok":
        if (value !== "false") { fieldProperties.nullok = true; }
        break;
      case "skipout":
        if (value !== "false") { fieldProperties.skipout = true; }
        break;
      case "label":
        if (value !== "false") { fieldProperties.label = true; }
        break;
      default:
        console.warn("Unknown identifier!", "\ncommand: ", command, "\nmatch: ", match);
    }
  });

  let fields = texCSVtoArray(command.body);
  fields.forEach(field => {
    parsedCommands.fieldTypes.set(field, fieldProperties);
  });
}

function stripComments(text) {
  const READING = 0;
  const COMMENT = 1;

  let processedString = "";
  let commentStartIndex = 0;
  let lastCommentEndIndex = 0;

  let state = READING;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    switch (state) {
      case READING:
        if (char === "%") {
          processedString += text.slice(lastCommentEndIndex, i);
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

  processedString += text.slice(lastCommentEndIndex);
  return processedString;
}








function readdir(dirPath) {
  return new Promise((resolve, reject) => {
    fs.readdir(dirPath, (err, children) => {
      resolve(children);
    });
  });
}

function getStats(somePath) {
  return new Promise((resolve, reject) => {
    fs.stat(somePath, (err, stats) => {
      resolve(stats);
    });
  });
}

function readFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf-8", (err, contents) => {
      resolve(contents);
    });
  });
}


function convertMaps(input) {
  if (input instanceof Map) {
    let mapObj = {};
    input.forEach((value, key) => mapObj[key] = convertMaps(value));
    return mapObj;
  } else if (input instanceof Set) {
    let setArray = [];
    input.forEach(value => setArray.push(convertMaps(value)));
    return setArray;
  } else if (input instanceof Object) {
    let keys = Object.keys(input);
    let newObject = {};
    keys.forEach(key => {
      let oldValue = input[key];
      newObject[key] = convertMaps(oldValue);
    });
    return newObject;
  } else {
    return input;
  }
}
