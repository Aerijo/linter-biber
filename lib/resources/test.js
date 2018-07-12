const util = require("util");
const fs = require("fs");

const StyleRegistry = require("../classes/style-registry.js");
const Style = require("../classes/style.js");
const ProtoStyle = require("../classes/protostyle.js");


const defaultTemplate = require("../cite_styles/templates/default_datamodel.json");
const apaTemplate = require("../cite_styles/templates/apa.json");
const { buildProtoStyleFromTemplates } = require("./utilities.js");
const { generateTemplateFromDBX } = require("./generate_template.js");

async function main() {

  fs.readdir("../cite_styles/templates", (err, data) => {
    data = data.map(name => name.slice(0, -5));
    fs.writeFile("./names");
  });
}

main();
