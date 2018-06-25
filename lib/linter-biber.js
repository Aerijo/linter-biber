const Parser = require("tree-sitter");
const Biber  = require("tree-sitter-biber");
const child_process = require("child_process");

const { CompositeDisposable } = require("atom");
const { entryFields, entryAliases, ignoredEntries, unsupportedEntries, fieldAliases, specialFields } = require("./constants.js");
const { validDateFormat, isExpectedField, unseenRequiredFields } = require("./utils.js");

const MAX_NUM_LINES = 30000; // arbitrary limit to prevent accidentally parsing enormous files (if they even exist)

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
class Linter {
  constructor(editor, linterInterface, ignoredLints) {
    // also grab user settings here, and combine them with the builtins in constants.js

    this.editor = editor;
    this.nativeBuffer = editor.getBuffer().buffer;

    let filePath = editor.getPath();
    if (filePath) { this.filePath = filePath; }
    this.linterInterface = linterInterface;
    this.lintMessages = [];
    this.ignoredLints = ignoredLints;

    this.parser = new Parser();
    this.parser.setLanguage(Biber);

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
  async lint(event) { // jshint ignore:line
    if (!this.editor.alive || !this.filePath) { return; } // AFAIK the linter package itself only works with an existing path

    /*
    * NOTE: the parsing should work with enormous files. However, other packages induce lag so it's hard to tell.
    * Also, `event.changes` can potentially be used to reduce parsing (but apparently bugged out when I first tried).
    */
    let tree;
    try {
      let oldTree = this.parser.parse(""); // using the actual oldtree seemed to bug out when greatly increasing range; should investigate further
      tree = await this.parser.parseTextBuffer(this.nativeBuffer, oldTree, { syncOperationCount: 1000 }); // jshint ignore:line
    } catch (error) {
      atom.notifications.addError("`linter-biber`: Something went wrong when parsing the `.bib` file", { dimissible: true });
      throw error;
    }

    // Set up values that are tracked globally
    this.lintMessages = [];
    this.keys = new Map();
    this.strings = new Map();
    this.preambles = new Map();

    this.generateLintsForNode(tree.rootNode);
    this.setLintMessages(this.lintMessages);
  }

  generateLintsForNode(node) {
    if (node.startPosition.row > MAX_NUM_LINES) { return; }
    switch (node.type) {
      case "entry":
        this.parseEntry(node);
        return;
      case "comment_command":
        let atSignNode = node.children[0];
        let openStringNode = node.children[1];
        let range = [atSignNode.endPosition, openStringNode.startPosition];
        this.makeInfo({ range, id: "014", msg: "@COMMENT commands can break with BiBTeX", detail: "This message is disabled by default. Backwards compatability is overrated" });
        break;
      case "comment":
        break;
      case "junk":
        this.makeWarning({ node, id: "001", msg: "Junk throws a warning", detail: "I recommend disabling this warning" });
        break;
      case "string_command":
        this.parseMacro(node);
        break;
      case "preamble_command":
        break;
      case "ERROR":
        this.makeError({ node, id: "000", msg: "Unhandled error" });
        break;
      case "MISSING":
        break;
      default:
    }

    node.children.forEach(child => this.generateLintsForNode(child));
  }

  parseEntry(node) {
    if (node.type !== "entry") { console.log("non-entry node!", node); return; }

    const observedFields = new Map();

    const nameNode = node.firstNamedChild;
    let entryName = this.getNodeValue(nameNode).toLowerCase();

    if (entryName.length === 0) {
      // NOTE: The 0th element should always be @, because otherwise this "entry" would be categorised as junk
      const range = [node.children[0].startPosition, node.children[2].startPosition]; // cover the @ too so it's visible
      this.makeError({ range, id: "004", msg: "Missing entry name" });
      return;
    }

    if (entryAliases.has(entryName)) {
      let aliasName = entryAliases.get(entryName);
      this.makeInfo({ node: nameNode, id: "017", msg: `Entry ${entryName.toUpperCase()} is alias for ${aliasName.toUpperCase()}` });
      entryName = aliasName;
    }

    const keyNode = nameNode.nextNamedSibling;
    const keyName = this.getNodeValue(keyNode);

    if (keyName.length === 0) { // we look at the key before checking if entry is supported (because key is still recognised by biber)
      this.makeError({ node: nameNode, id: "012", msg: "Empty key name" });
    } else {
      if (this.keys.has(keyName)) {
        let dupeKeyNode = this.keys.get(keyName);
        let line = dupeKeyNode.startPosition.row + 1;
        let col = dupeKeyNode.startPosition.column + 1;
        this.makeWarning({ node: keyNode, id: "011", msg: `Duplicate key "${keyName}" (${line}:${col})`, detail: `(Original on line ${line}, column ${col}). Only the first entry for each key is used. Later entries sharing the key name are ignored` });
      } else {
        this.keys.set(keyName, keyNode);
      }

      if (!/^[!-~]+$/.test(keyName)) { // visible ASCII
        this.makeWarning({ node: keyNode, id: "013", msg: "Non-ASCII characters in key", detail: "While non-ASCII may work if using xetex & co., they may break if used with pdftex. If that is not a concern, this warning can be safely disabled" });
      }
    }

    if (unsupportedEntries.has(entryName)) {
      this.makeWarning({ node: nameNode, id: "016", msg: `Entry type ${entryName.toUpperCase()} is unsupported` });
      return;
    }

    const expectedFields = entryFields.get(entryName);
    if (!expectedFields) { this.makeInfo({ node: nameNode, id: "005", msg: "Unknown entry name" }); }

    let crossref = false;
    node.children.forEach(child => {
      if (child.type !== "field" || child.hasError()) {
        if (child.hasError() && child.type !== "key") {
          if (child.nextSibling === null) {
            this.makeError({ node: child, id: "020", msg: "Missing closing delimiter" });
          } else {
            this.makeError({ node: child, id: "019", msg: "Unhandled error in entry field", detail: "Maybe you forgot a comma or # ?. I'll be making this error more sophisticated eventually." });
          }
        }
        return;
      }

      const fieldNode = child;
      const fieldIdentifierNode = fieldNode.children[0];
      let fieldName = this.getNodeValue(fieldIdentifierNode).toLowerCase();

      if (fieldAliases.has(fieldName)) {
        let aliasName = fieldAliases.get(fieldName);
        this.makeInfo({ node: fieldIdentifierNode, id: "015", msg: `Field name ${fieldName.toUpperCase()} is an alias for ${aliasName.toUpperCase()}` });
        fieldName = aliasName;
      }

      if (observedFields.has(fieldName)) {
        this.makeWarning({ node: fieldIdentifierNode, id: "006", msg: "Duplicate field" });
      } else {
        observedFields.set(fieldName, fieldNode);
      }

      if (fieldName === "crossref") { crossref = true; }

      if (ignoredEntries.has(fieldName)) { return; } // ignored, but we still look for duplicates (above)

      if (specialFields.has(fieldName)) { return; }

      if (expectedFields && !isExpectedField(fieldName, expectedFields)) {
        this.makeWarning({ node: fieldIdentifierNode, id: "007", msg: "Unexpected field" });
      }

      if (/^(url|event|orig)?date$/.test(fieldName) && fieldNode.children.length >= 3) {
        const dateNode = fieldNode.children[2];
        const dateValue = this.getStringValue(dateNode);
        if (!dateValue.includes("#") && !validDateFormat(dateValue)) { // silently ignore if macros and concatenation are involved (may come back to this)
          this.makeWarning({ node: dateNode, id: "010", msg: "Invalid date format", detail: "Expected (a subset of) yyyy-mm-ddThh:nn[+-][hh[:nn]Z]. Optionally add an end date separated from the start with / " });
        }
      }
    });

    if (expectedFields) {
      // NOTE: Also needs to support crossreferencing
      let missing = unseenRequiredFields(observedFields, expectedFields);
      if (missing.length > 0 && !crossref) {
        const s = missing.length === 1 ? "" : "s";
        this.makeWarning({ node: nameNode, id: "008", msg: `Missing required field${s}: ${missing.map(entry => entry.toUpperCase()).join(", ")}`});
      }

      if (observedFields.has("year")) {
        let yearNode = observedFields.get("year").children[0];
        if (observedFields.has("date")) {
          this.makeInfo({ node: yearNode, id: "009", msg: "YEAR field will be overriden by DATE"});
        } else {
          this.makeInfo({ node: yearNode, id: "010", msg: "YEAR field should be replaced by DATE", detail: "DATE is fully compatible with the exisiting YEAR field, and allows for more comprehensive information gathering"});
        }
      }
    }
  }

  getNodeValue(node) {
    return this.nativeBuffer.getTextInRange({ start: node.startPosition, end: node.endPosition });
  }

  getStringValue(node) {
    let nodeValue = this.getNodeValue(node);
    if (nodeValue.length < 2) { console.warn("string node is too short", node); return ""; }
    return /^("|{)/.test(nodeValue) ? nodeValue.slice(1, -1) : nodeValue; // remove both ends (if there are string delims)
  }

  setLintMessages(messages) {
    messages = messages.filter(message => !this.ignoredLints.has(message.id));
    this.linterInterface.setMessages(this.filePath, messages);
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
        position: details.range || [details.node.startPosition, details.node.endPosition]
      },
      excerpt: `E${details.id || "999"} - ${details.msg}`,
      description: details.detail
    });
  }
}


/*
* This class is responsible for managing which editors
* get the linting. It will observe text editor creation,
* as well as grammar changes in these text editors.
*/
class EditorRegistry {
  constructor(linterInterface) {
    this.linterInterface = linterInterface;
    this.editorDataByID = new Map();
    this.parser = new Parser();
    this.parser.setLanguage(Biber);

    this.setIgnoredLints();
  }

  add(editor) {
    if (this.has(editor)) { console.log("already added"); return; }

    let lifeCycleDisposables = new CompositeDisposable();

    this.editorDataByID.set(editor.id, {
      editor,
      lifeCycleDisposables,
      subscribed: false
    });

    lifeCycleDisposables.add(

      editor.observeGrammar(grammar => {
        let isBiber = grammar.fileTypes.includes("bib") && /\bbiber\b/.test(grammar.scopeName);
        let subscribed = this.isSubscribed(editor);
        let container = this.get(editor);

        if (isBiber && !subscribed) {
          this.addSubscription(container, editor);
        } else if (!isBiber && subscribed) {
          this.removeSubscription(container, editor);
        }
      }),

      editor.onDidDestroy(() => {
        this.remove(editor);
      })

    );
  }

  isSubscribed(editor) {
    return this.has(editor) && this.get(editor).subscribed;
  }

  addSubscription(container, editor) {
    if (container.subscribed) { console.log("already subscribed!"); return; }

    container.linter = new Linter(editor, this.linterInterface, this.ignoredLints);
    container.subscribed = true;
  }

  removeSubscription(container, editor) {
    if (!container.subscribed) { console.log("already removed!"); return; }

    container.linter.remove();
    container.subscribed = false;
  }

  has(editor) {
    return this.editorDataByID.has(editor.id);
  }

  get(editor) {
    return this.editorDataByID.get(editor.id);
  }

  remove(editor) {
    if (!this.has(editor)) { return; }
    const container = this.get(editor);

    container.lifeCycleDisposables.dispose();
    this.removeSubscription(container, editor);

    this.editorDataByID.delete(editor.id);
  }

  dispose() {
    for (let [id, container] of this.editorDataByID) {
      container.lifeCycleDisposables.dispose();
      if (container.linter) { container.linter.remove(); }
    }

    if (this.ignoredLintsSubscription) { this.ignoredLintsSubscription.dispose(); }
  }

  setIgnoredLints() {
    this.ignoredLintsSubscription = atom.config.observe("linter-biber.ignoredLints", value => {
      this.ignoredLints = new Set(
        value.map(id => id.length === 2 ? "0"+id : id.length === 1 ? "00"+id : id)
      );

      this.editorDataByID.forEach(container => {
        if (container.linter) {
          container.linter.ignoredLints = this.ignoredLints;
          container.linter.lint({ changes: null });
        }
      });
    });
  }
}

module.exports = { EditorRegistry };
