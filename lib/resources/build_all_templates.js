const fs = require("fs");
const path = require("path");

const { generateTemplateFromDBX } = require("./generate_template.js");
const { findFilesByExtension } = require("./utilities.js");

const packagesPath = "/usr/local/texlive/2018/texmf-dist/tex/latex";
const defaultStylePath = "../cite_styles/models/default_datamodel.dbx";

const INDENT = 2;

module.exports = { main };
if (require.main === module) {
  main();
}

async function main() {
  const externalStylePaths = await findFilesByExtension(packagesPath, ".dbx");
  externalStylePaths.push(defaultStylePath);

  const metaInformation = {
    styles: []
  };

  for (let i = 0; i < externalStylePaths.length; i++) {
    const filePath = externalStylePaths[i];
    let styleTemplate;
    try {
      styleTemplate = await generateTemplateFromDBX(filePath);
    } catch (e) {
      console.error(e);
      continue;
    }

    if (styleTemplate === null) { continue; }

    const fileName = path.basename(filePath, ".dbx");

    styleTemplate.name = fileName;
    styleTemplate.filePath = filePath;

    metaInformation.styles.push(fileName);

    const printReady = JSON.stringify(styleTemplate, null, INDENT);
    fs.writeFile(`../cite_styles/templates/${styleTemplate.name}.json`, printReady,
      { encoding: "utf-8" }, () => { console.log(` - ${styleTemplate.name}`); }
    );
  }

  fs.writeFile(`../cite_styles/meta/meta.json`, JSON.stringify(metaInformation, null, INDENT),
    { encoding: "utf-8"}, () => { console.log("Written meta data"); }
  );
}
