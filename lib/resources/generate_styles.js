const fs = require("fs");
const path = require("path");

const { generateStyle } = require("./parse_model_file.js");
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
    let style;
    try {
      style = await generateStyle(filePath);
    } catch (e) {
      console.error(e);
      continue;
    }

    if (style === null) { continue; }

    const fileName = path.basename(filePath, ".dbx");

    style.name = fileName;
    style.filePath = filePath;

    metaInformation.styles.push(fileName);

    const printReady = JSON.stringify(style, null, INDENT);
    fs.writeFile(`../cite_styles/styles/${style.name}.json`, printReady, { encoding: "utf-8" },
      () => { console.log(` - ${style.name}`); }
    );
  }

  fs.writeFile(`../cite_styles/meta/meta.json`, JSON.stringify(metaInformation, null, INDENT),
    { encoding: "utf-8"}, () => { console.log("Written meta data"); }
  );
}