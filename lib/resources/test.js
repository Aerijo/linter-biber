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

  const registry = new StyleRegistry();

  const apaStyle = registry.getStyle("apa");

  console.log(apaStyle);

  // const defaultTemplate = await generateTemplateFromDBX("../cite_styles/models/default_datamodel.dbx");
  // const protoStyle = new ProtoStyle([defaultTemplate, apaTemplate]);
  // const style = new Style("apa", protoStyle);
  // const print = util.inspect(style, { colors: false, depth: Infinity });
  // fs.writeFile("./styleResult.txt", print, { encoding: "utf-8" }, () => {console.log("printed");});
}

main();
