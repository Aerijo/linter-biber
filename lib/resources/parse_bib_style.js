const fs = require("fs");
const path = require("path");

const packagesPath = "/usr/local/texlive/2018/texmf-dist/tex/latex";
const defaultModelFile = "./default_datamodel.dbx";
var validateFields; // for when making the defaults
var defaultCommands;


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
*/


if (require.main === module) {
  main();
}

async function main() {
  defaultCommands = await gatherStyleCommands(defaultModelFile);

  const defaultStyle = await getStyleDef(defaultModelFile);

  const externalStylePaths = await findFilesByExtension(packagesPath, ".dbx");

  externalStylePaths.push(defaultModelFile);

  const styleDefinitions = new Map();

  for (let i = 0; i < externalStylePaths.length; i++) {
    validateFields = true;
    let file = externalStylePaths[i];
    let bibData;
    try {
      bibData = await getStyleDef(file);
    } catch (e) {
      console.error(e);
      continue;
    }

    if (bibData === null) { continue; }

    let fileName = path.basename(file, ".dbx");
    if (styleDefinitions.has(fileName)) {
      console.error("duplicate file names!", fileName);
      console.log(file);
      continue;
    }
    bibData.styleName = path.basename(fileName);
    bibData.filePath = file;

    let printReady = JSON.stringify(convertMaps(bibData), null, 2);
    fs.writeFile(`../cite_styles/${bibData.styleName}.json`, printReady, { encoding: "utf-8" }, () => { console.log(fileName); });
  }
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
  if (commands === null) { return null; }
  let parsedCommands = parseStyleCommands(commands);
  let validatedCommands = validateCommands(parsedCommands);
  return validatedCommands;
}

async function gatherStyleCommands(filePath) {
  let text = await readFile(filePath);
  text = stripComments(text);

  const gatheredCommands = (filePath !== defaultModelFile && defaultCommands && defaultCommands.slice()) || [];
  const originalLength = gatheredCommands.length;

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

  if (gatheredCommands.length === originalLength) {
    return null;
  }
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
    universalFields: new Set(), // for fields not tied to a set of entries
    universalConstraints: new Set(),
    fieldTypes: new Map(),
    constants: new Map()
  };

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
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
  const constraintText = command.body;
  const parsedConstraints = parseConstraintText(constraintText);
  if (command.options === null) {
    parsedCommands.universalConstraints.add(...parsedConstraints);
  } else {
    const entries = texCSVtoArray(command.options);
    entries.forEach(entry => {
      let entryConstraints = parsedCommands.entryConstraints.get(entry);
      if (entryConstraints) {
        entryConstraints.add(...parsedConstraints);
      } else {
        parsedCommands.entryConstraints.set(entry, new Set(parsedConstraints));
      }
    });
  }
}

function parseConstraintText(text) {
  const constraintList = getConstraintList(text);
  return constraintList;
}

function texCSVtoArray(csv) {
  return csv
    // .replace(/%[^\n]*\n/g, "") // remove comments // already done when read in
    .trim() // remove outer whitespace
    .split(/\s*,\s*/) // split values
    .filter(value => value.length > 0); // remove empty values
}

function addEntryTypes(command, parsedCommands) {
  // options say if it is a skipout entry (default false)
  // We'll just ignore it, and come back if it happens to be relevant
  texCSVtoArray(command.body).forEach(entry => parsedCommands.entries.add(entry));
}

function addEntryFields(command, parsedCommands) {
  const fields = texCSVtoArray(command.body);
  const validEntries = command.options !== null ? texCSVtoArray(command.options) : [];

  if (validEntries.length === 0) {
    fields.forEach(field => parsedCommands.universalFields.add(field));
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
  } else if (input instanceof Array) {
    return input.map(value => convertMaps(value));
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

function validateCommands(commands) {
  if (!validateFields) { return commands; }
  const validCommands = {
    entries: commands.entries,
    entryConstraints: commands.entryConstraints,
    entryFields: new Map(),
    universalFields: new Set(),
    universalConstraints: commands.universalConstraints,
    fieldTypes: commands.fieldTypes,
    untypedFields: new Set(),
    constants: commands.constants
  };

  commands.entryFields.forEach((fieldsForEntry, entry) => {
    const validEntryFields = new Set();
    fieldsForEntry.forEach(field => {
      validEntryFields.add(field);
      if (!validCommands.fieldTypes.has(field)) {
        validCommands.untypedFields.add(field);
      }
    });

    validCommands.entryFields.set(entry, validEntryFields);
  });

  commands.universalFields.forEach(field => {
    validCommands.universalFields.add(field);
    if (!validCommands.fieldTypes.has(field)) {
      validCommands.untypedFields.add(field);
    }
  });

  return validCommands;
}

function getConstraintList(text) {
  const constraints = getAllCommands(text);

  constraints.forEach(constraint => {
    if (/\\/.test(constraint.body)) {
      const oldBody = constraint.body;
      const parsedCommands = getConstraintList(oldBody);
      constraint.body = parsedCommands;
    }

    if (constraint.options !== null && /=/.test(constraint.options)) {
      const oldOptions = constraint.options;
      const newOptions = getValueOptions(oldOptions);
      constraint.options = newOptions;
    }
  });

  return constraints;
}

function getValueOptions(text) {
  const options = {};
  const optionPairs = texCSVtoArray(text).map(value => value.split("="));
  optionPairs.forEach(([key, value]) => options[key] = value);
  return options;
}

function getAllCommands(text) {
  const commands = [];
  let index = 0;
  while (true) {
    const command = getNextCommand(text, index);
    if (command === null) { break; }

    index = command.endIndex;
    commands.push({
      name: command.name,
      options: command.options,
      body: command.body
    });
  }

  return commands;
}







function getNextCommand(text, index=0) {
  const commandRegex = /\\([a-zA-Z]+)\s*/g;
  const optionsRegex = /\[([^\]]*)\]\s*/g;

  commandRegex.lastIndex = index;
  const match = commandRegex.exec(text);

  if (match === null) { return null; }

  const name = match[1];
  let bodyStartIndex = commandRegex.lastIndex;

  let options = null;
  if (text.charAt(bodyStartIndex) === "[") {
    optionsRegex.lastIndex = bodyStartIndex;
    const optionsMatch = optionsRegex.exec(text);

    options = optionsMatch[1];
    bodyStartIndex = optionsRegex.lastIndex;
  }

  let body = gatherBody(text, bodyStartIndex);

  return {
    name,
    options,
    body,
    endIndex: bodyStartIndex + body.length
  };
}
