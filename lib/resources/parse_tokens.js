const util = require("./utilities");

function parseConstantToken(token, gatheredCommands, misc) {
  const constDef = misc.tokens[misc.index + 1];
  if (constDef.type !== "text") { console.error("Expected text!", token, misc); return; }
  const constant = {
    type: "string",
    name: token.body,
    value: constDef.body.trim().slice(1, -1)
  };

  if (token.options !== null) {
    const options = util.getParameterOptions(token.options);
    if (options.type && options.type === "list") {
      constant.type = options.type;
      constant.value = util.CSVtoArray(constant.value);
    }
  }

  gatheredCommands.constants.push(constant);
}

function parseEntryTypeToken(token, gatheredCommands, misc) {
  let skipout = false;
  if (token.options) {
    const options = util.getParameterOptions(token.options);
    skipout = options.skipout || false;
  }

  const entries = util.CSVtoArray(token.body);
  entries.forEach(name => gatheredCommands.entries.set(name, { skipout }));
}

function parseFieldToken(token, gatheredCommands, misc) {
  if (token.options === null) { console.error("Empty field options!", token, misc); return; }
  const props = util.getParameterOptions(token.options);
  const fieldProps = {
    type:     props.type || null,
    format:   props.format || null,
    datatype: props.datatype || null,
    nullok:   props.nullok,
    skipout:  props.skipout,
    label:    props.label,
  };

  if (fieldProps.nullok  !== true) { fieldProps.nullok  = false; }
  if (fieldProps.skipout !== true) { fieldProps.skipout = false; }
  if (fieldProps.label   !== true) { fieldProps.label   = false; }

  if (fieldProps.type === null || fieldProps.datatype === null) {
    console.error("Missing field type or datatype!", fieldProps, token, misc);
  }

  const fieldNames = util.CSVtoArray(token.body);
  fieldNames.forEach(name => gatheredCommands.fields.set(name, fieldProps));
}

function parseEntryFieldsToken(token, gatheredCommands, misc) {
  const entries = util.CSVtoArray(token.options);
  const fields = util.CSVtoArray(token.body);
  if (entries === null || entries.length === 0) {
    fields.forEach(field => gatheredCommands.universalFields.add(field));
    return;
  }

  entries.forEach(entry => {
    if (gatheredCommands.entryFields.has(entry)) {
      const entryFieldsSet = gatheredCommands.entryFields.get(entry);
      fields.forEach(field => entryFieldsSet.add(field));
    } else {
      gatheredCommands.entryFields.set(entry, new Set(fields));
    }
  });
}

function parseConstraintToken(token, gatheredCommands, misc) {
  const entries = util.CSVtoArray(token.options);
  const constraintTokens = token.tokenisedBody;

  const constraints = constraintTokens
    .map(tok => parseConstraint(tok))
    .filter(constraint => constraint !== null);

  if (entries === null || entries.length === 0) {
    gatheredCommands.universalConstraints.push(...constraints);
  } else {
    gatheredCommands.entryConstraints.push({ entries, constraints });
  }
}

function parseConstraint(token) {
  const options = util.getParameterOptions(token.options);
  const type = options.type;
  if (!type) { console.error("Missing constraint type!", token); return null; }
  switch (type) {
    case "mandatory":
    return {
      type,
      value: parseMandatoryConstraint(token.tokenisedBody)
    };
    case "conditional":
    return {
      type,
      value: parseConditionalConstraint(token.tokenisedBody)
    };
    case "data":
    return {
      type,
      value: parseDataConstraint(token, options)
    };
  }
}

function parseMandatoryConstraint(tokens) {
  const entryFieldConstraints = {
    all: [],
    some: [],
    one: []
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const command = token.name;
    let fieldNames;
    switch (command) {
      case "constraintfieldsor":
      fieldNames = token.tokenisedBody.map(childToken => childToken.body);
      entryFieldConstraints.some.push(fieldNames);
      break;
      case "constraintfieldsxor":
      fieldNames = token.tokenisedBody.map(childToken => childToken.body);
      entryFieldConstraints.one.push(fieldNames);
      break;
      case "constraintfield":
      entryFieldConstraints.all.push(token.body);
      break;
      default:
      console.error("Unaccounted for constraint!", token);
    }
  }
  return entryFieldConstraints;
}

function parseConditionalConstraint(tokens) {
  return token;
}

function parseDataConstraint(token, options) {
  const fields = token.tokenisedBody.map(childToken => childToken.body);
  return {
    fields,
    options
  };
}



module.exports = {
  parseConstantToken,
  parseEntryTypeToken,
  parseFieldToken,
  parseEntryFieldsToken,
  parseConstraintToken
};
