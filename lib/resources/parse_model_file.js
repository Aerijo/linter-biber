const util = require("./utilities.js");
const {
  parseConstantToken,
  parseEntryTypeToken,
  parseFieldToken,
  parseEntryFieldsToken,
  parseConstraintToken
} = require("./parse_tokens.js");

if (require.main === module) {
  main();
};

async function main() {
  const myStyle = await generateStyle("../cite_styles/models/example.dbx");
  // const myStyle = await generateStyle("../cite_styles/models/default_datamodel.dbx");
  console.log(require("util").inspect(myStyle, { colors: true, depth: Infinity }));
}

async function generateStyle(filePath) {
  let text;
  try {
    text = await util.readFile(filePath)
      .then(text => util.stripComments(text))
      .catch(e => { throw e; });
  } catch (e) {
    console.error(new Error(e));
    return null;
  }

  const tokens = util.tokeniseText(text);
  const styleProperties = gatherStyleProperties(tokens);
  if (util.isEmptyStyle(styleProperties)) { return null; }
  return util.serialise(styleProperties);
}

function gatherStyleProperties(tokens) {
  const gatheredCommands = {
    constants: [],
    entries: [],
    fields: [],
    entryFields: new Map(),
    universalFields: new Set(),
    entryConstraints: [],
    universalConstraints: [],
    resetPriorEntries: false,
    resetPriorFields: false,
    resetPriorEntryFields: false,
    resetPriorConstraints: false
  };

  for (let i = 0; i < tokens.length; i++) {
    const misc = { index: i, tokens };
    const token = tokens[i];
    if (token.type !== "command") { continue; }

    switch (token.name) {
      case "DeclareDatamodelConstant":
        parseConstantToken(token, gatheredCommands, misc);
        break;
      case "DeclareDatamodelEntrytypes":
        parseEntryTypeToken(token, gatheredCommands, misc);
        break;
      case "DeclareDatamodelFields":
        parseFieldToken(token, gatheredCommands, misc);
        break;
      case "DeclareDatamodelEntryfields":
        parseEntryFieldsToken(token, gatheredCommands, misc);
        break;
      case "DeclareDatamodelConstraints":
        parseConstraintToken(token, gatheredCommands, misc);
        break;
      case "ResetDatamodelEntrytypes":
        gatheredCommands.entries = new Map();
        gatheredCommands.resetPriorEntries = true;
        break;
      case "ResetDatamodelFields":
        gatheredCommands.fields = new Map();
        gatheredCommands.resetPriorFields = true;
        break;
      case "ResetDatamodelEntryfields":
        gatheredCommands.entryFields = new Map();
        gatheredCommands.universalFields = new Set();
        gatheredCommands.resetPriorEntryFields = true;
        break;
      case "ResetDatamodelConstraints":
        gatheredCommands.entryConstraints = [];
        gatheredCommands.universalConstraints = [];
        gatheredCommands.resetPriorConstraints = true;
        break;
    }
  }

  return gatheredCommands;
}

module.exports = { generateStyle };
