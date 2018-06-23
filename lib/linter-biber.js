const Parser = require("tree-sitter");
const Biber  = require("tree-sitter-biber");
const child_process = require("child_process");

const parser = new Parser();
parser.setLanguage(Biber);

var i = 0;
var tree;

module.exports = {
  name: "Biber",
  scope: "file",
  lintsOnChange: true,
  grammarScopes: ["biber"],

  lint(editor) {
    return new Promise(async (resolve, reject) => {
      let filePath = editor.getPath(); console.log(filePath);

      let myVal = await myWait();

      if (!tree) {
        tree = parser.parse(editor.getText());
      } else {
        tree = await parser.parseTextBuffer(editor.getBuffer().buffer, tree, {
        syncOperationCount: 1000
        });
      }

      console.log(tree);

      i += 1;

      resolve([{
        severity: 'info',
        location: {
          file: filePath,
          position: [[i-1, 0], [i-1, 3]]
        },
        excerpt: `We have a wild ${myVal}`,
        description: "Did it work?"
      }]);
    });
  }
};



function myWait() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log("is resolved");
      resolve("resolved");
    }, 1000);
  });
}

/*

GOAL:

Editor.buffer.onDidStopChanging
  => tree sitter parse union of new and old range
  => run through and extract messages (in change range)
  => remove old in change range and push new messages in change range

*/
