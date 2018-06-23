const linter = require("./linter-biber.js");

module.exports = {
  activate() {
    console.log("activated linter");
  },

  provideLinter() {
    console.log("providing linter");
    return linter;
  }
};
