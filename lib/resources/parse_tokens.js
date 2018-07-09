const util = require("./utilities.js");

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
  let options = { skipout: false };
  if (token.options) {
    options = util.getParameterOptions(token.options);
    options.skipout = options.skipout || false;
  }

  const entries = util.CSVtoArray(token.body).map(name => name.toUpperCase());
  gatheredCommands.entries.push({ names: entries, properties: options });
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

  const fieldNames = util.CSVtoArray(token.body).map(name => name.toUpperCase());
  gatheredCommands.fields.push({ names: fieldNames, properties: fieldProps });
}

function parseEntryFieldsToken(token, gatheredCommands, misc) {
  let entries = util.CSVtoArray(token.options);
  const fields = util.CSVtoArray(token.body);
  if (entries === null || entries.length === 0) {
    fields.forEach(field => gatheredCommands.universalFields.add(field.toUpperCase()));
    return;
  }

  entries = entries.map(name => name.toUpperCase());
  entries.forEach(entry => {
    if (gatheredCommands.entryFields.has(entry)) {
      const entryFieldsSet = gatheredCommands.entryFields.get(entry);
      fields.forEach(field => entryFieldsSet.add(field.toUpperCase()));
    } else {
      gatheredCommands.entryFields.set(entry, new Set(fields.map(name => name.toUpperCase())));
    }
  });
}

function parseConstraintToken(token, gatheredCommands, misc) {
  let entries = util.CSVtoArray(token.options);
  const constraintTokens = token.tokenisedBody;

  const constraints = constraintTokens
    .map(tok => parseConstraint(tok))
    .filter(constraint => constraint !== null);

  if (entries === null || entries.length === 0) {
    gatheredCommands.universalConstraints.push(...constraints);
  } else {
    entries = entries.map(name => name.toUpperCase());
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
      fieldNames = token.tokenisedBody.map(childToken => childToken.body.toUpperCase());
      entryFieldConstraints.some.push(fieldNames);
      break;
      case "constraintfieldsxor":
      fieldNames = token.tokenisedBody.map(childToken => childToken.body.toUpperCase());
      entryFieldConstraints.one.push(fieldNames);
      break;
      case "constraintfield":
      entryFieldConstraints.all.push(token.body.toUpperCase());
      break;
      default:
      console.error("Unaccounted for constraint!", token, tokens);
    }
  }
  return entryFieldConstraints;
}

function parseConditionalConstraint(tokens) {
  let antecedentType = null;
  let antecedentFields = [];
  let consequentType = null;
  let consequentFields = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const options = util.getParameterOptions(token.options);
    const fields = token.tokenisedBody.map(child => child.body.toUpperCase());
    if (token.name === "antecedent") {
      antecedentType = options.quantifier;
      antecedentFields.push(...fields);
    } else if (token.name === "consequent") {
      consequentType = options.quantifier;
      consequentFields.push(...fields);
    } else {
      console.error("Unexpected constraint!", token, tokens);
    }
  }

  if (antecedentType === null || consequentType === null) {
    console.error("Missing antecedent / consequence", tokens);
    return null;
  }

  return {
    antecedent: {
      required: antecedentType,
      fields: antecedentFields
    },
    consequent: {
      required: consequentType,
      fields: consequentFields
    }
  };
}

function parseDataConstraint(token, options) {
  const fields = token.tokenisedBody.map(childToken => childToken.body.toUpperCase());
  return {
    fields,
    properties: options
  };
}



module.exports = {
  parseConstantToken,
  parseEntryTypeToken,
  parseFieldToken,
  parseEntryFieldsToken,
  parseConstraintToken
};
