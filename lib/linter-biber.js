const Parser = require("tree-sitter");
const Biber  = require("tree-sitter-biber");
const child_process = require("child_process");

const { CompositeDisposable } = require("atom");
const { entryFields, fieldAliases } = require("./constants.js");

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
  constructor(editor, linterInterface) {
    // also grab user settings here, and combine them with the builtins in constants.js

    this.editor = editor;
    this.nativeBuffer = editor.getBuffer().buffer;

    let filePath = editor.getPath();
    if (filePath) { this.filePath = filePath; }
    this.linterInterface = linterInterface;
    this.lintMessages = [];

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

    this.lintMessages = [];

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

    let lints = this.generateLintsForNode(tree.rootNode);

    this.setLintMessages(this.lintMessages);
  }

  generateLintsForNode(node) {
    switch (node.type) {
      case "entry":
        this.parseEntry(node);
        return;
      case "comment_command":
      case "comment":
        break;
      case "junk":
        this.makeWarning({ node, id: "001", msg: "Junk throws a warning", detail: "I recommend disabling this warning" });
        break;
      case "string_command":
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
    const lints = [];
    const observedFields = new Set();

    let nameNode = node.firstNamedChild;
    const entryName = this.getNodeValue(nameNode).toLowerCase();
    console.log(entryName);

    if (entryName.length === 0) {
      console.log(nameNode);
      // NOTE: The 0th element should always be @, because otherwise this "entry" would be categorised as junk
      const range = [node.children[0].startPosition, node.children[2].startPosition]; // cover the @ too so it's visible
      this.makeWarning({ range, id: "004", msg: "Missing entry name" });
    }
  }

  getNodeValue(node) {
    return this.nativeBuffer.getTextInRange({ start: node.startPosition, end: node.endPosition });
  }

  setLintMessages(messages) {
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

    container.linter = new Linter(editor, this.linterInterface);
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
  }
}

module.exports = { EditorRegistry };
