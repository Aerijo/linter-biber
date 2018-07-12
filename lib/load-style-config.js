const fs = require("fs");
const path = require("path");

const StyleConfig = require("./classes/style-config.js");

if (require.main === module) {
  main();
};

function main() {
  const config = getStyleConfig("~/linter-biber-config.yaml");
  const print = require("util").inspect(config, { colors: true, depth: Infinity });
  console.log(print);
}



function getStyleConfig(filePath) {
  if (filePath[0] === '~') {
    filePath = path.join(process.env.HOME, filePath.slice(1));
  }

  const extension = path.extname(filePath);
  let rawConfig;
  try {
    switch (extension) {
      case ".json":
      case ".js":
      rawConfig = require(filePath);
      break;
      case ".cson":
      rawConfig = require("season").readFileSync(filePath);
      break;
      case ".yaml":
      rawConfig = require("yamljs").load(filePath);
      break;
      default: return null;
    }
  } catch (e) {
    console.error(e);
    return null;
  }

  return new StyleConfig(rawConfig);
}




module.exports = { getStyleConfig };
