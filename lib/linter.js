const Parser = require("tree-sitter");
const Biber  = require("tree-sitter-biber");

const CitationRegistry = require("./citation-registry.js");

const { CompositeDisposable } = require("atom");
const { validDateFormat, isExpectedField, unseenRequiredFields } = require("./utils.js");

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
*/
module.exports = class Linter {
  constructor(editor, linterInterface, ignoredLints, maxLines) {
    this.editor = editor;
    this.filePath = editor.getPath();
    this.nativeBuffer = editor.getBuffer().buffer;

    this.maxLines = maxLines; // limit to prevent parsing enormous files
    this.linterInterface = linterInterface;
    this.lintMessages = [];
    this.ignoredLints = ignoredLints;

    this.citationRegistry = new CitationRegistry();

    this.parser = new Parser();
    this.parser.setLanguage(Biber);

    this.setExternalCitationStyles();

    this.textDisposables = new CompositeDisposable();
    this.textDisposables.add(
      editor.buffer.onDidStopChanging(event => this.lint(event))
    );

    this.lint({ changes: null }); // kick off the first lint
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
  * NOTE: jshint doesn't support async/await yet
  */
  async lint(event) {
    this.filePath = this.editor.getPath();
    // AFAIK the linter package itself only works with an existing path
    if (!this.editor.alive || !this.filePath) { return; }
    /*
    * NOTE: the parsing should work with enormous files. However, other packages
    * induce lag so it's hard to tell. Also, `event.changes` can potentially be
    *  used to reduce parsing (but apparently bugged out when I first tried).
    */
    let tree;
    try {
      let oldTree = this.parser.parse("");
      tree = await this.parser.parseTextBuffer(this.nativeBuffer, oldTree, {
        syncOperationCount: 1000
      });
    } catch (error) {
      // errors are thrown when we start parsing before the previous is finished.
      // Can happen with enormous files.
      throw error;
    }

    // Set up values that are tracked globally
    this.lintMessages = [];
    this.entries = new Map(); // key: entry, value: fields
    this.keys = new Map(); // key: keyName, value: keyNode
    this.strings = new Map(); // unused
    this.preambles = new Map(); // unused

    this.expectedEntriesMap = this.citationRegistry.getExpectedEntries();

    this.generateLintsForNode(tree.rootNode);

    if (this.citationStyle === undefined) {
      this.setLintMessages(this.lintMessages);
    } else {
      this.setLintMessages(this.lintMessages);
    }
  }

  generateLintsForNode(node) {
    if (node.startPosition.row > this.maxLines) { return; }
    let range;
    switch (node.type) {
      case "entry":
        this.parseEntry(node);
        return;
      case "comment_command":
        this.parseCommentCommand(node);
        return;
      case "junk":
        range = this.backtrackWhitespaceRange(node);
        this.makeWarning({
          range,
          id: "001",
          msg: "Junk throws a warning",
          detail: "I recommend disabling this warning"
        });
        break;
      case "string_command":
        // this.parseMacro(node);
        break;
      case "preamble_command":
        // this.parsePreamble(node);
        break;
      case "ERROR":
        this.makeError({ node, id: "000", msg: "Unhandled error" });
        break;
      case "MISSING":
        break;
      default:
        node.children.forEach(child => this.generateLintsForNode(child));
    }
  }

  parseEntry(entryNode) {
    // Set up entry wide values
    this.entryNameNode = null;
    this.entryName = "";
    this.isExternalEntry = false;
    this.keyNode = null;
    this.keyName = "";
    this.observedFields = new Set();
    this.parseFields = true;

    this.parseEntryName(entryNode);
    this.parseEntryKey(entryNode);

    if (!this.parseFields) { return; }

    this.expectedFields = this.entryProperties.expectedFields;

    const fieldStartIndex = this.fieldStartIndex || 0;

    for (let i = fieldStartIndex; i < entryNode.children.length; i++) {
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
        this.parseField(child);
      }
    }

    this.postProcessEntry();
  }

  postProcessEntry() {
    // // NOTE: Also needs to support crossreferencing
    // let missing = unseenRequiredFields(observedFields, expectedFields);
    // if (missing.length > 0 && !crossref) {
    //   const s = missing.length === 1 ? "" : "s";
    //   this.makeWarning({
    //     node: nameNode,
    //     id: "008",
    //     msg: `Missing required field${s}:\
    //       ${missing.map(entry => entry.toUpperCase()).join(", ")}`});
    // }
    //
    // if (observedFields.has("year")) {
    //   let yearNode = observedFields.get("year").children[0];
    //   if (observedFields.has("date")) {
    //     this.makeInfo({
    //       node: yearNode,
    //       id: "009",
    //       msg: "YEAR field will be overriden by DATE"});
    //   } else {
    //     this.makeInfo({
    //       node: yearNode,
    //       id: "010",
    //       msg: "YEAR field should be replaced by DATE",
    //       detail: "DATE is fully compatible with the exisiting YEAR field, and\
    //         allows for more comprehensive information gathering"});
    //   }
    // }
  }

  parseEntryName(entryNode) {
    const entryNameData = this.findChildNode(entryNode, "name", 0);
    if (entryNameData === null) {
      // I don't think this will ever throw, because an empty node is made regardless
      this.makeError({ node: entryNode, id: "072", msg: "Cannot find entry name location" });
      this.parseFields = false;
      return;
    }

    this.entryNameNode = entryNameData.node;
    this.entryNameIndex = entryNameData.index;
    this.entryName = this.getNodeValue(this.entryNameNode).toLowerCase();

    if (this.entryName.length === 0) {
      this.makeError({ node: this.entryNameNode, id: "004", msg: "Missing entry name" });
      this.parseFields = false;
      return;
    }

    this.entryProperties = this.expectedEntriesMap.get(this.entryName);
    if (!this.entryProperties) {
      this.makeWarning({ node: this.entryNameNode, id: "005", msg: "Unknown entry name" });
      this.parseFields = false;
      return;
    }

    if (this.entryProperties.isAlias) {
      this.makeInfo({
        node: this.entryNameNode,
        id: "017",
        msg: `Entry ${this.entryName.toUpperCase()} is alias for\
          ${this.entryProperties.aliasName.topUpperCase()}`
        });
    }
  }

  parseEntryKey(entryNode) {
    const entryNameIndex = this.entryNameIndex || 0;
    const keyNodeData = this.findChildNode(entryNode, "key", entryNameIndex + 1);
    if (keyNodeData === null) {
      // again, I don't think this will actually throw
      this.makeError({ node: entryNode, id: "071", msg: "Cannot find key node" });
      console.log(entryNode);
      this.parseFields = false;
      return;
    }

    this.keyNode = keyNodeData.node;
    this.keyIndex = keyNodeData.index;
    this.keyName = this.getNodeValue(this.keyNode);

    if (this.keyName.length === 0) {
      this.makeError({ node: nameNode, id: "012", msg: "Empty key name" });
      return;
    }

    if (this.keys.has(this.keyName)) {
      let dupeKeyNode = this.keys.get(this.keyName);
      let line = dupeKeyNode.startPosition.row + 1;
      let col = dupeKeyNode.startPosition.column + 1;
      this.makeWarning({
        node: keyNode,
        id: "011",
        msg: `Duplicate key "${keyName}" (${line}:${col})`,
        detail: `(Original on line ${line}, column ${col}). Only the first entry\
        for each key is used. Later entries sharing the key name are ignored`
      });
    } else {
      this.keys.set(this.keyName, this.keyNode);
    }

    if (!/^[!-~]+$/.test(this.keyName)) { // visible ASCII
      this.makeWarning({
        node: this.keyNode,
        id: "013",
        msg: "Non-ASCII characters in key",
        detail: "While non-ASCII may work if using XeTeX & co., they may break if\
          used with pdfTeX. If that is not a concern, this warning can be safely disabled"
      });
    }

    let commaData = this.findNextChildNode(entryNode, ",", this.keyIndex + 1);
    if (!commaData) {
      this.makeError({ node: this.keyNode, id: "099", msg: "Missing comma after key" });
      this.parseFields = false;
    } else {
      this.fieldStartIndex = commaData.index + 1;
    }
  }

  parseField(fieldNode) {
    const fieldIdentifierNode = fieldNode.children[0]; // I think this always works
    const fieldName = this.getNodeValue(fieldIdentifierNode).toLowerCase();

    if (fieldName.length === 0) {
      this.makeError({ node: fieldIdentifierNode, id: "042", msg: `Field name is missing` });
      return;
    }

    const fieldProperties = this.entryProperties.expectedFields.get(fieldName);
    if (!fieldProperties) {
      this.makeWarning({ node: fieldIdentifierNode, id: "007", msg: "Unknown field" });
      return;
    }

    if (fieldProperties.isAlias) {
      this.makeInfo({
        node: fieldIdentifierNode,
        id: "015",
        msg: `Field ${fieldName.toUpperCase()} is alias\
        for ${fieldProperties.aliasName.toUpperCase()}`
      });
    }

    if (this.observedFields.has(fieldName)) {
      this.makeWarning({ node: fieldIdentifierNode, id: "006", msg: "Duplicate field" });
    } else {
      this.observedFields.set(fieldName, fieldNode);
    }

    // if unexpected field, warning 007

    if (fieldProperties.type === "date" && fieldNode.children.length >= 3) {
      const dateNode = fieldNode.children[2];
      const dateValue = this.getStringValue(dateNode);
      if (!dateValue.includes("#") && !validDateFormat(dateValue)) {
        // silently ignored if macros and concatenation are involved (may come back to this)
        this.makeWarning({
          node: dateNode,
          id: "010",
          msg: "Invalid date format",
          detail: "Expected (a subset of) yyyy-mm-ddThh:nn[+-][hh[:nn]Z].\
            Optionally add an end date separated from the start with / "
        });
      }
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
