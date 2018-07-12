module.exports = class StyleConfig {
  constructor(rawUserConfig) {
    this.global = null;
    this.styles = new Map(); // name -> config data

    if (rawUserConfig.global) {
      this.global = this.parseConfig(rawUserConfig.global);
    }

    if (rawUserConfig.styles) {
      const styleConfigs = rawUserConfig.styles;
      const styleNames = Object.keys(styleConfigs);
      styleNames.forEach(name => {
        const props = this.parseConfig(styleConfigs[name]);
        this.styles.set(name, props);
      });
    }
  }

  parseConfig(config) {
    const props = {
      lints: {
        watch: [],
        ignore: []
      },
      fields: [],
      entries: []
    };

    if (config.lints) {
      this.addLints(config.lints, props);
    }

    if (config.fields) {
      this.addFields(config.fields, props);
    }

    if (config.entries) {
      this.addEntries(config.entries, props);
    }

    return props;
  }

  addLints(lintData, props) {
    for (let i = 0; i < lintData.length; i++) {
      const command = lintData[i];
      const match = /^\s*(w|watch|i|ignore)\s+([\s0-9,]+)$/.exec(command);
      if (!match) { console.error("Unrecognised entry:", command); continue; }

      const numbers = match[2]
        .split(/\s*,\s*/)
        .filter(num => num !== null && num.length > 0)
        .map(num => num.length === 1 ? "00" + num : num.length === 2 ? "0" + num : num);

      switch (match[1]) {
        case "w":
        case "watch":
        props.lints.watch.push(...numbers);
        break;
        case "i":
        case "ignore":
        props.lints.ignore.push(...numbers);
        break;
        default: console.error("Unknown lint command:", match[1], "for", command);
      }
    }
  }

  addFields(fieldCommands, props) {
    for (let i = 0; i < fieldCommands.length; i++) {
      const command = fieldCommands[i];
      const parsedCommand = parseFieldCommand(command);
      if (parsedCommand === null) { continue; }
      props.fields.push(parsedCommand);
    }
  }

  addEntries(entryCommands, props) {
    for (let i = 0; i < entryCommands.length; i++) {
      const command = entryCommands[i];
      const parsedCommand = parseEntryCommand(command);
      if (parsedCommand === null) { continue; }
      props.entries.push(parsedCommand);
    }
  }
};


function parseFieldCommand(command) {
  const properties = {
    type: null,
    name: null,
    options: []
  };

  const commandRegex = /^\s*([a-zA-Z]+)\s+([a-zA-Z]+)\s*(?:\{([a-zA-Z,\s=]*)\})?\s*$/;
  const match = commandRegex.exec(command);
  if (match === null) { console.error("Cannot parse field command", command); return null; }

  switch (match[1]) {
    case "a":
    case "add":
    properties.type = "add";
    break;
    case "r":
    case "remove":
    properties.type = "remove";
    break;
    case "s":
    case "set":
    properties.type = "set";
    break;
    default: console.error("Unrecognised directive", match[1], "for", command); return null;
  }

  properties.name = match[2].toUpperCase();

  if (match[3] !== undefined) {
    const options = parseOptions(match[3]);
    properties.options = options;
  }

  return properties;
}

function parseEntryCommand(command) {
  const properties = {
    type: null,
    name: null,
    options: []
  };

  const commandRegex = /^\s*([a-zA-Z]+)\s+([a-zA-Z]+)\s*(?:\{([^\}]*)\})?\s*$/;
  const match = commandRegex.exec(command);
  if (match === null) { console.error("Cannot parse field command", command); return null; }

  switch (match[1]) {
    case "a":
    case "add":
    properties.type = "add";
    break;
    case "r":
    case "remove":
    properties.type = "remove";
    break;
    case "s":
    case "set":
    properties.type = "set";
    break;
    default: console.error("Unrecognised directive", match[1], "for", command); return null;
  }

  properties.name = match[2].toUpperCase();

  if (match[3] !== undefined) {
    const options = parseOptions(match[3]);
    properties.options = options;
  }

  return properties;
}





function parseOptions(text) {
  const options = [];
  const LOOKING_KEY = 0;
  const KEY = 1;
  const LOOKING_VALUE = 4;
  const ARRAY_VALUE = 2;
  const STRING_VALUE = 3;

  let key = "";
  let value = "";
  let startIndex = 0;

  let state = LOOKING_KEY;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    switch (state) {
      case LOOKING_KEY:
      if (/[\s,]/.test(char)) {
        continue;
      } else if (/[a-zA-Z]/.test(char)) {
        startIndex = i;
        state = KEY;
      } else {
        console.error("Invalid key name l in", text);
        return null;
      }
      break;
      case KEY:
      if (/[\s=]/.test(char)) {
        key = text.slice(startIndex, i).toLowerCase();
        state = LOOKING_VALUE;
      } else if (char === ",") {
        key = text.slice(startIndex, i).toLowerCase();
        options.push([key, null]);
        state = LOOKING_KEY;
      } else if (/[a-zA-Z]/.test(char)) {
        continue;
      } else {
        console.error("Invalid key name in", text);
      }
      break;
      case LOOKING_VALUE:
      if (/[\s=]/.test(char)) {
        continue;
      } else if (/[a-zA-Z]/.test(char)) {
        startIndex = i;
        state = STRING_VALUE;
      } else if (char === "[") {
        startIndex = i + 1;
        state = ARRAY_VALUE;
      } else if (char === ",") {
        options.push([key, null]);
        state = LOOKING_KEY;
      } else {
        console.error("Invalid value name in", text);
        return null;
      }
      break;
      case STRING_VALUE:
      if (!/[a-zA-Z]/.test(char)) {
        value = text.slice(startIndex, i);
        options.push([key, value]);
        state = LOOKING_KEY;
      }
      break;
      case ARRAY_VALUE:
      if (char === "]") {
        value = text.slice(startIndex, i);
        options.push([key, value]);
        state = LOOKING_KEY;
      }
      break;
    }
  }

  switch (state) {
    case LOOKING_KEY:
    break;
    case KEY:
    key = text.slice(startIndex);
    case LOOKING_VALUE:
    options.push([key, null]);
    break;
    case ARRAY_VALUE:
    case STRING_VALUE:
    value = text.slice(startIndex);
    options.push([key, value]);
    break;
  }

  return options;
}
