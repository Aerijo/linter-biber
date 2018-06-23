const Parser = require('tree-sitter');
const biber = require('tree-sitter-biber');
const parser = new Parser();




module.exports = {
  activate() {
    parser.setLanguage(biber);

    const test1 = "hello world";

    let tree = parser.parse(test1);

    console.log(tree.rootNode.toString());
  }
};
