const util = require("util");
const fs = require("fs");

const Style = require("../classes/style.js");


const defaultTemplate = require("../cite_styles/templates/default_datamodel.json");
const apaTemplate = require("../cite_styles/templates/apa.json");
const { buildProtoStyleFromTemplates } = require("./utilities.js");
const { generateTemplateFromDBX } = require("./generate_template.js");

async function main() {
  const defaultTemplate = await generateTemplateFromDBX("../cite_styles/models/default_datamodel.dbx");
  const protoStyle = buildProtoStyleFromTemplates([defaultTemplate, apaTemplate]);
  // console.log(util.inspect(protoStyle, { colors: true, depth: Infinity }));

  const style = new Style("apa", protoStyle);
  console.log(style);
  // const print = util.inspect(style, { colors: true, depth: Infinity });
  // console.log(print);
  // fs.writeFile("./styleResult.txt", print, { encoding: "utf-8" }, () => {console.log("printed");});


  // console.log(protoStyle);

}

main();
