const Parser = require("tree-sitter");
const Biber  = require("tree-sitter-biber");

const StyleRegistry = require("./classes/style-registry.js");

const { CompositeDisposable } = require("atom");
const { validDateFormat, isExpectedField, unseenRequiredFields } = require("./utilities.js");

/*
* Handles linting of a given text editor. Things like grammar
* changing and editor removal are handled by the EditorRegistry
*
* This class will subscribe to editor changes, and push linting
* messages to the linterInferface provided by consuming the `linter`
* service.
*
* To make these messages, it uses it's own parser set to Biber. This
* parses the underlying TextBuffer directly, so should work for all
* editors (even if not saved to disk).
*
* The resulting tree is then recursively traversed, and rules are
* applied at each node to look for known errors / warnings / info.
*
* IMPROVEMENT: Each entry is largely independent, so reparse only those within
* changes. Also do a relatively quicker run along all entries, to get global
* lints for duplicate keys and such. Use the row of each lint message to determine
* if it's within changes. Ensure all lints are in order.
*/
module.exports = class Linter {
  constructor(editor, styleConfig, linterInterface, ignoredLints=new Set(), maxLines=1e4) {
    this.editor = editor;
    this.filePath = editor.getPath();
    this.nativeBuffer = editor.getBuffer().buffer;

    this.maxLines = maxLines; // limit to prevent linting enormous files
    this.linterInterface = linterInterface;
    this.lintMessages = [];
    this.ignoredLints = ignoredLints;

    this.styleRegistry = new StyleRegistry(styleConfig);
    const activeStyleName = atom.config.get("linter-biber.activeStyle");
    this.style = this.styleRegistry.getStyle(activeStyleName);

    if (styleConfig) {
      if (styleConfig.global) {
        styleConfig.global.lints.ignore.forEach(
          num => this.ignoredLints.has(num) || this.ignoredLints.add(num)
        );
        styleConfig.global.lints.watch.forEach(
          num => this.ignoredLints.delete(num)
        );
      }
      if (styleConfig.styles.has(activeStyleName)) {
        const props = styleConfig.styles.get(activeStyleName);
        props.lints.ignore.forEach(
          num => this.ignoredLints.has(num) || this.ignoredLints.add(num)
        );
        props.lints.watch.forEach(
          num => this.ignoredLints.delete(num)
        );
      }
    }

    this.parser = new Parser();
    this.parser.setLanguage(Biber);

    this.textDisposables = new CompositeDisposable();
    this.textDisposables.add(
      editor.buffer.onDidStopChanging(event => this.lint(event))
    );

    this.lint({ changes: [] }); // kick off the first lint
  }

  remove() {
    this.linterInterface.setMessages(this.filePath, []);
    this.textDisposables.dispose();
  }

  /*
  * The most important method. Async because we wait for the parse to finish.
  *
  * IMPROVEMENT: Maybe this entire function can go on a separate process? Even though
  * parsing is separate (if it takes too long), actually traversing the finished tree
  * may take a significant length of time. Needs proper profiling.
  *
  * NOTE: ask about the best way to do this in Atom on Slack
  */
  async lint(event={}) {
    this.filePath = this.editor.getPath();
    if (!this.editor.alive || !this.filePath) { return; }

    // console.time("tree-gen");
    let tree = await this.getTree(event);
    // console.timeEnd("tree-gen");

    if (!tree) { return; }

    // Set up values that are global
    this.lintMessages = [];
    this.strings = new Map(); // unused
    this.preambles = new Map(); // unused
    this.keys = new Map(); // key: keyName, value: keyNode

    // this.earliestStartChangeRow = getTextChangesStartRow(event.changes);
    // this.resetLaterLints(this.earliestStartChangeRow);

    // console.time("linting");
    this.generateLintsForRootNode(tree.rootNode);
    // console.timeEnd("linting");

    // console.time("setting-messages");
    this.setLintMessages(this.lintMessages);
    // console.timeEnd("setting-messages");

  }

  async getTree(event={}) {
    try {
      if (treeSitterGrammarAvailable(this.editor)) {
        return this.editor.languageMode.tree;
      }
      let oldTree = this.parser.parse("");
      let tree = await this.parser.parseTextBuffer(this.nativeBuffer, oldTree, {
        syncOperationCount: 1000 // arbitrary; taken from tree-sitter homepage
      });
      return tree;
    } catch (error) {
      // errors are thrown when we start parsing before the previous is finished.
      // Can happen with enormous files.
      console.error(error);
      return null;
    }
  }

  generateLintsForRootNode(rootNode) {
    rootNode.children.forEach(node => {
      if (node.startPosition.row > this.maxLines) { return; }

      switch (node.type) {
        case "entry":
          this.parseEntry(node);
          break;
        case "comment_command":
          this.parseCommentCommand(node);
          break;
        case "junk":
          let range = this.backtrackWhitespaceRange(node);
          this.makeWarning({
            range,
            id: "001",
            msg: "Junk throws a warning",
            detail: "I recommend disabling this warning"
          });
          break;
        case "string_command":
          this.parseMacro(node);
          break;
        case "preamble_command":
          // this.parsePreamble(node);
          break;
        case "ERROR":
          this.makeError({ node, id: "000", msg: "Unhandled error" });
          break;
        case "MISSING":
          break;
      }
    });
  }

  parseMacro(node) {
    return null; // TODO
  }

  parseEntry(entryNode) {
    const props = {
      entryNameNode: null,
      entryNameIndex: 0,
      entryName: "",
      entry: null,
      isExternalEntry: false,
      keyNode: null,
      keyName: "",
      observedFields: new Map(),
      expectedFields: null,
      parseFields: true,
      postProcessEntry: true,
      fieldStartIndex: 0
    };

    this.parseEntryName(entryNode, props);
    this.parseEntryKey(entryNode, props);

    if (!props.parseFields) {
      // If we don't do a more in depth search, we do a simple error search
      // we start past the key if possible, because that is always linted
      for (let i = props.fieldStartIndex; i < entryNode.children.length; i++) {
        const child = entryNode.children[i];
        this.lintErrors(child);
      }
      return;
    }

    for (let i = props.fieldStartIndex; i < entryNode.children.length; i++) {
      const child = entryNode.children[i];

      if (child.hasError()) {
        if (child.nextSibling === null) {
          this.makeError({
            node: child,
            id: "020",
            msg: "Missing closing delimiter"
          });
        } else {
          this.makeError({
            node: child,
            id: "019",
            msg: "Unhandled error in entry field",
            detail: "Maybe you forgot a # or comma? I'll be making this error more\
              sophisticated eventually."
          });
        }
        return;
      }

      if (child.type === "field") {
        this.parseField(child, props);
      }
    }

    if (props.postProcessEntry) {
      this.postProcessEntry(entryNode, props);
    }
  }

  postProcessEntry(entryNode, props) {
    const issues = props.entry.checkConstraints(props.observedFields);

    const entryNameNode = props.entryNameNode;
    if (issues.missingAllFields.length > 0) {
      this.makeWarning({
        node: entryNameNode,
        id: "034",
        msg: `Missing required fields: ${issues.missingAllFields}`
      });
    }

    if (issues.missingSomeFields.length > 0) {
      this.makeWarning({
        node: entryNameNode,
        id: "035",
        msg: `Missing at least one field of: [${issues.missingSomeFields.join("], [")}]`
      });
    }

    if (issues.missingOneField.length > 0) {
      this.makeWarning({
        node: entryNameNode,
        id: "036",
        msg: `Missing one of: [${issues.missingOneField.join("], [")}]`
      });
    }

    if (issues.tooManyFields.length > 0) {
      this.makeWarning({
        node: entryNameNode,
        id: "037",
        msg: `Too many of: [${issues.tooManyFields.join("], [")}]`
      });
    }

    if (issues.failedConditionals.length > 0) {
      issues.failedConditionals.forEach(([antecedent, consequent]) => {
        this.makeWarning({
          node: entryNameNode,
          id: "038",
          msg: `Failed conditional.`,
          detail: `Saw ${antecedent.required} of [${antecedent.fields}] and expected ${consequent.required} of [${consequent.fields}]`
        });
      });
    }
  }

  parseEntryName(entryNode, props) {
    const entryNameData = this.findChildNode(entryNode, "name", 0);
    if (entryNameData === null) {
      // I don't think this will ever throw, because an empty node is made regardless
      this.makeError({ node: entryNode, id: "002", msg: "Cannot find entry name location" });
      props.parseFields = false;
      return;
    }

    props.entryNameNode = entryNameData.node;
    props.entryNameIndex = entryNameData.index;
    props.entryName = this.getNodeValue(entryNameData.node).toUpperCase();

    if (props.entryName.length === 0) {
      this.makeError({ node: props.entryNameNode, id: "004", msg: "Missing entry name" });
      props.parseFields = false;
      return;
    }

    props.entry = this.style.getEntry(props.entryName);
    if (!props.entry) {
      this.makeWarning({ node: props.entryNameNode, id: "005", msg: "Unexpected entry name" });
      props.parseFields = false;
      return;
    }

    props.expectedFields = props.entry.fields;
  }

  parseEntryKey(entryNode, props) {
    const entryNameIndex = props.entryNameIndex;
    const entryNameNode = props.entryNameNode || entryNode;
    const keyNodeData = this.findChildNode(entryNode, "key", entryNameIndex + 1);
    if (keyNodeData === null) {
      this.makeError({ node: entryNameNode, id: "071", msg: "Cannot find key" });
      props.parseFields = false;
      return;
    }

    props.keyNode = keyNodeData.node;
    props.keyIndex = keyNodeData.index;
    const keyName = this.getNodeValue(keyNodeData.node);
    props.keyName = keyName;

    if (keyName.length === 0) {
      this.makeError({ node: entryNameNode, id: "012", msg: "Empty key name" });
      return;
    }

    if (this.keys.has(keyName)) {
      const dupeKeyNode = this.keys.get(keyName);
      const line = dupeKeyNode.startPosition.row + 1;
      const col = dupeKeyNode.startPosition.column + 1;
      this.makeWarning({
        node: props.keyNode,
        id: "011",
        msg: `Duplicate key "${keyName}" (${line}:${col})`,
        detail: `(Original on line ${line}, column ${col}). Only the first entry\
        for each key is used. Later entries sharing the key name are ignored`
      });
    } else {
      this.keys.set(keyName, props.keyNode);
    }

    if (!/^[!-~]+$/.test(keyName)) { // visible ASCII
      this.makeWarning({
        node: props.keyNode,
        id: "013",
        msg: "Non-ASCII characters in key",
        detail: "While non-ASCII may work if using XeTeX & co., they may break if\
          used with pdfTeX. If that is not a concern, this warning can be safely disabled"
      });
    }

    let commaData = this.findNextChildNode(entryNode, ",", props.keyIndex + 1);
    if (!commaData) {
      this.makeError({ node: props.keyNode, id: "099", msg: "Missing comma after key" });
      props.parseFields = false;
    } else {
      props.fieldStartIndex = commaData.index + 1;
    }
  }

  parseField(fieldNode, props) {
    const fieldIdentifierNode = fieldNode.children[0]; // I think this always works
    const fieldName = this.getNodeValue(fieldIdentifierNode).toUpperCase();

    if (fieldName.length === 0) {
      this.makeError({ node: fieldIdentifierNode, id: "042", msg: `Field name is missing` });
      return;
    }

    if (fieldName === "crossref") {
      props.postProcessEntry = false;
    }

    if (props.observedFields.has(fieldName)) {
      this.makeWarning({ node: fieldIdentifierNode, id: "006", msg: "Duplicate field" });
    } else {
      props.observedFields.set(fieldName, fieldNode);
    }

    let field = props.entry.fields.get(fieldName);

    if (!field) {
      this.makeWarning({ node: fieldIdentifierNode, id: "007", msg: "Unexpected field" });
      return;
    }

    const fieldValueData = this.getFieldValueData(fieldNode);
    const fieldValue = fieldValueData.value;
    if (fieldValue !== null) {
      if (!field.nullok && fieldValue.length === 0) {
        this.makeWarning({
          node: fieldValueData.node,
          id: "085",
          msg: "Empty field value not allowed"
        });
        return;
      }
      const lintData = field.checkConstraints(fieldValue, "string");
      if (lintData !== null) {
        // we use the normal syntax here because passing messages gets a bit complicated
        this.lintMessages.push({
          severity: lintData.severity,
          location: {
            file: this.filePath,
            position: [fieldValueData.node.startPosition, fieldValueData.node.endPosition] // NOTE: Need value node instead
          },
          excerpt: lintData.msg,
          description: lintData.detail
        });
      }
    }
  }

  getFieldValueData(fieldNode) {
    const valueNodeData = this.findChildNode(fieldNode, "value", 2);
    if (valueNodeData === null) {
      return { value: null, node: null };
    }

    let values = [];

    for (let i = 0; i < valueNodeData.node.namedChildren.length; i++) {
      const token = valueNodeData.node.namedChildren[i];
      if (token.type !== "token") { continue; }
      const tokenType = token.children[0].type;
      switch (tokenType) {
        case "string":
        values.push(this.getStringValue(token));
        break;
        case "nonnegative_integer":
        values.push(this.getNodeValue(token));
        break;
        case "identifier":
        const identifierValue = this.getIdentifierValue(this.getNodeValue(token));
        if (identifierValue === null) {
          return { value: null, node: valueNodeData.node };
        } else {
          values.push(identifierValue);
        }
      }
    }

    return { value: values.join(""), node: valueNodeData.node };
  }

  getIdentifierValue(identifier) {
    if (this.strings.has(identifier)) {
      return this.strings.get(identifier);
    } else {
      return this.style.getIdentifierValue(identifier);
    }
  }

  parseCommentCommand(node) {
    if (node.type !== "comment_command") { console.log("non-cc node!", node); return; }

    const atSignNode = node.children[0];
    const openStringNode = node.children[1];
    const range = [atSignNode.endPosition, openStringNode.startPosition];
    this.makeInfo({
      range,
      id: "014",
      msg: "@COMMENT commands can break with BiBTeX",
      detail: "This message is disabled by default. Backwards compatability is overrated"
    });

    const startDelimNode = node.children[1];
    const endDelimNode = node.children[2];
    const startDelimChar = this.getNodeValue(startDelimNode);
    const startDelimIsParen = startDelimChar === "(";
    const commentText = this.getInclusiveTextInNodes(startDelimNode, endDelimNode);

    let parenCount = 0;
    let braceCount = 0;
    let row = startDelimNode.startPosition.row;
    let col = startDelimNode.startPosition.column;

    let lastOpenBraceRow = row;
    let lastOpenBraceCol = col;
    let lastCloseBraceRow = row;
    let lastCloseBraceCol = col;

    for (let i = 0; i < commentText.length; i++) {
      switch (commentText.charAt(i)) {
        case "{":
          braceCount += 1;
          lastOpenBraceRow = row;
          lastOpenBraceCol = col;
          break;
        case "(":
          parenCount += 1;
          break;
        case "}":
          braceCount -= 1;
          lastCloseBraceRow = row;
          lastCloseBraceCol = col;
          if (braceCount < 0) {
            this.makeError({
              position: [row, col],
              id: "021",
              msg: "Unbalanced }",
              detail: "With biber, there is no way to escape characters. If you\
               need a brace, try using a TeX command."
            });
          }
          break;
        case ")":
          parenCount -= 1;
          if (!startDelimIsParen) { break; }
          if (parenCount < 0) {
            this.makeError({
              position: [row, col],
              id: "022",
              msg: "Unbalanced )",
              detail: "With biber, there is no way to escape characters. If you\
                need a parenthesis, try using making the outer delims braces, or\
                use a TeX command."
              });
          } else if (parenCount === 0) {
            if (braceCount > 0) {
              this.makeError({
                position: [lastOpenBraceRow, lastOpenBraceCol],
                id: "021",
                msg: "Unbalanced }",
                detail: "Braces must still be balanced when inside a parenthesis\
                  delimited comment"
              });
            } else if (braceCount < 0) {
              this.makeError({
                position: [lastCloseBraceRow, lastCloseBraceCol],
                id: "021",
                msg: "Unbalanced {",
                detail: "Braces must still be balanced when inside a parenthesis\
                  delimited comment"
              });
            }
          }
          break;
        case "\n":
          row += 1;
          col = -1; // +1 will be added after this switch block
          break;
      }
      col += 1;
    }
  }

  getNodeValue(node) {
    return this.nativeBuffer.getTextInRange({
      start: node.startPosition,
      end: node.endPosition
    });
  }

  getInclusiveTextInNodes(startNode, endNode) {
    return this.nativeBuffer.getTextInRange({
      start: startNode.startPosition,
      end: endNode.endPosition
    });
  }

  getStringValue(node) {
    let nodeValue = this.getNodeValue(node);
    if (nodeValue.length < 2) { console.warn("string node is too short", node); return ""; }
    return /^("|{)/.test(nodeValue) ? nodeValue.slice(1, -1) : nodeValue;
  }

  backtrackWhitespaceRange(node) {
    let text = this.getNodeValue(node);
    let row = node.endPosition.row;
    let col = 0;
    let revCol = 0; // "reverse" column; counting from right end
    for (let i = text.length - 1; i >= 0; i--) {
      let char = text.charAt(i);
      if (/\S/.test(char)) {
        col += 1;
        for (let j = i - 1; j >= 0; j--) { // find the start of the line
          col += 1;
          char = text.charAt(j);
          if (char === "\n") { break; }
        }
        break;
      }
      if (char === "\n") {
        row -= 1;
        revCol = 0;
      } else {
        revCol += 1;
      }
    }
    return [node.startPosition, [row, col]];
  }

  setLintMessages(messages) {
    messages = messages.filter(message => !this.ignoredLints.has(message.id));
    this.linterInterface.setMessages(this.filePath, messages);
  }

  setExternalCitationStyles() {

  }

  findChildNode(parentNode, targetName, startIndex=0, haltOnError=true) {
    for (let i = startIndex; i < parentNode.children.length; i++) {
      let child = parentNode.children[i];
      switch (child.type) {
        case targetName:
          return { node: child, index: i };
          break;
        case "ERROR":
          if (haltOnError) {
            this.makeError({
              node: child,
              id: "098",
              msg: `Error when looking for ${targetName} node!`
            });
            return null;
          }
          break;
      }
    }
    return null;
  }

  findNextChildNode(parentNode, targetName, startIndex=0, throwIfError=false) {
    for (let i = startIndex; i < parentNode.children.length; i++) {
      const child = parentNode.children[i];
      switch (child.type) {
        case targetName:
          return { node: child, index: i };
          break;
        case "comment":
          break;
        case "ERROR":
          if (throwIfError) {
            this.makeError({
              node: child,
              id: "098",
              msg: `Error when looking for ${targetName} node!`
            });
          }
          return null;
        default:
          // if we see an unexpected node
          return null;
      }
    }
    return null;
  }

  lintErrors(node) {
    if (node.hasError()) { // true if any children have errors
      if (node.type === "ERROR") {
        this.makeError({
          node,
          id: "998",
          msg: "Error encountered"
        });
      } else if (node.startIndex === node.endIndex) { // node.isMissing() doesn't appear to work
        this.makeWarning({
          node,
          id: "997",
          msg: "Missing node"
        });
      }

      node.children.forEach(child => this.lintErrors(child));
    }
  }

  /*
  * These functions allow for abbreviated message creation.
  * They take an object with
  *  - `id` number string for reference. E.g., "002", "031", etc.
  *  - `msg` for visible bubble text
  *  - `detail` for expandable bubble text
  *  - `node` for the relevant node in the tree (used for range) OR
  *  - `range` for a custom range (takes precedence)
  */
  makeInfo(details) {
    this.lintMessages.push({
      id: details.id,
      severity: "info",
      location: {
        file: this.filePath,
        position: details.range || [details.node.startPosition, details.node.endPosition]
      },
      excerpt: `I${details.id || "999"} - ${details.msg}`, // use 999 to represent missing ID
      description: details.detail
    });
  }

  makeWarning(details) {
    this.lintMessages.push({
      id: details.id,
      severity: "warning",
      location: {
        file: this.filePath,
        position: details.range || [details.node.startPosition, details.node.endPosition]
      },
      excerpt: `W${details.id || "999"} - ${details.msg}`,
      description: details.detail
    });
  }

  makeError(details) {
    this.lintMessages.push({
      id: details.id,
      severity: "error",
      location: {
        file: this.filePath,
        position: details.range ||
          (details.position ?
            [details.position, [details.position[0], details.position[1] + 1]] :
            false) || [details.node.startPosition, details.node.endPosition]
      },
      excerpt: `E${details.id || "999"} - ${details.msg}`,
      description: details.detail
    });
  }
};


function treeSitterGrammarAvailable(editor) {
  const languageMode = editor.languageMode;
  const usingTreeSitter = languageMode.grammar.constructor.name === "TreeSitterGrammar";
  const fullyTokenised = !languageMode.hasQueuedParse;
  return usingTreeSitter && fullyTokenised;
}

function getTextChangesStartRow(changes) {
  if (changes.length === 0) { return 0; }
  let startRow = Infinity;
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (change.start.row < startRow) {
      startRow = change.start.row;
    }
  }
  return startRow;
}
