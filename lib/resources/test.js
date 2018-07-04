const { constructStyleFromJSON } = require("../citation-classes.js");

const apa = constructStyleFromJSON(require("../cite_styles/apa.json"));

console.log(apa);
