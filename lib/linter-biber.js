const Parser = require("tree-sitter");
const Biber  = require("tree-sitter-biber");
const child_process = require("child_process");

const parser = new Parser();
parser.setLanguage(Biber);

module.exports = {
  name: "Biber",
  scope: "file",
  lintsOnChange: true,
  grammarScopes: ["biber"],

  lint(editor) {
    return new Promise(async (resolve, reject) => {
      let filePath = editor.getPath(); console.log(filePath);

      let myVal = await myWait();

      console.log(myVal);

      resolve([{
        severity: 'info',
        location: {
          file: filePath,
          position: [[0, 0], [0, 3]]
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
    }, 5000);
  });
}
