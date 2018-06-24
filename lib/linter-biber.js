const Parser = require("tree-sitter");
const Biber  = require("tree-sitter-biber");
const child_process = require("child_process");

const { CompositeDisposable } = require("atom");

class EditorContainer {
  constructor(linter) {
    this.linter = linter;
    this.editorDataByID = new Map();
    this.parser = new Parser();
    this.parser.setLanguage(Biber);
  }

  add(editor) {
    console.log("attempting to add");
    if (this.has(editor)) { console.log("already added"); return; }

    let lifeCycleDisposables = new CompositeDisposable();

    this.editorDataByID.set(editor.id, {
      editor,
      lifeCycleDisposables,
      subscribed: false
    });

    lifeCycleDisposables.add(

      editor.observeGrammar(grammar => {
        console.log("grammar changed");

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
        console.log(`destroyed editor ${editor.id}`);
        this.remove(editor);
        console.log(this.editorDataByID);
      })

    );

    console.log("current storage:", this.editorDataByID);
  }

  isSubscribed(editor) {
    return this.has(editor) && this.get(editor).subscribed;
  }

  addSubscription(container, editor) {
    console.log("adding hooks");
    if (container.subscribed) { console.log("already subscribed!"); return; }
    lint(this.parser, editor, this.linter, { changes: null }); // fire initial lint (not done by onDidStopChanging)

    container.textDisposables = new CompositeDisposable();
    container.textDisposables.add(
      editor.buffer.onDidStopChanging(event => lint(this.parser, editor, this.linter, event))
    );

    container.subscribed = true;
  }

  removeSubscription(container, editor) {
    console.log("removing hooks");
    if (!container.subscribed || !container.textDisposables) { console.log("already removed!"); return; }
    container.textDisposables.dispose();
    if (editor.getPath()) { this.linter.setMessages(editor.getPath(), []); }
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
      if (container.textDisposables) {
        container.textDisposables.dispose();
      }
    }
  }
}

async function lint(parser, editor, linter, { changes }) {
  if (!editor.alive) { return; }
  let editorPath = editor.getPath();
  if (!editorPath) { return; } // AFAIK the linter only works with an existing path

  /*
  * NOTE: the parsing should be tested with enormous files. So far, the parsing seems to be fine. However, other packages induce lag so it's hard to tell.
  * Also, changes can potentially be used to reduce parsing.
  */
  let tree;
  try {
    let oldTree = parser.parse(""); // using the actual oldtree seemed to bug out when greatly increasing range; should investigate further
    let buffer = editor.getBuffer().buffer;
    tree = await parser.parseTextBuffer(buffer, oldTree, { syncOperationCount: 1000 });
  } catch (error) {
    atom.notifications.addError("`linter-biber`: Something went wrong when parsing the `.bib` file", { dimissible: true });
    throw error;
    return;
  }

  console.log(tree);

  let handledNodes = {
    "entry":    [],
    "comment":  [],
    "junk":     [],
    "string":   [],
    "preamble": [],
    "error":    [],
    "missing":  [],
    "other":    []
  }

  // const sortFunc = (node) => {
  //   let type = node.type;
  //   switch (type) {
  //     case "entry":
  //       rootNodes.entry.push(node);
  //       break;
  //     case "comment_command":
  //     case "comment":
  //       rootNodes.comment.push(node);
  //       break;
  //     case "junk":
  //       rootNodes.junk.push(node);
  //       break;
  //     case "string_command":
  //       rootNodes.string.push(node);
  //       break;
  //     case "preamble_command":
  //       rootNodes.preamble.push(node);
  //       break;
  //     case "ERROR":
  //       // rootNodes.error.push(node); // we handle this separately for now
  //       break;
  //     case "MISSING":
  //       // rootNodes.error.push(node); // we handle this separately for now
  //       break;
  //     default:
  //       rootNodes.other.push(node);
  //   }
  // }

  generateAllLints(handledNodes, tree.rootNode); // NOTE: does not gather _all_ errors. E.g., empty keys are allowed (I think? Better double check)

  console.log(tree.rootNode.toString());
  let msg = [];
  handledNodes.junk.forEach(node => {
    msg.push({
      severity: "warning",
      location: {
        file: editorPath,
        position: [node.startPosition, node.endPosition]
      },
      excerpt: "002: Junk",
      description: "Top level junk is warned against by biber. I recommend disabling this warning honestly."
    })
  });

  handledNodes.error.forEach(node => {
    msg.push({
      severity: "error",
      location: {
        file: editorPath,
        position: [node.startPosition, node.endPosition]
      },
      excerpt: "000: unhandled ERROR",
      description: "Is error."
    })
  });

  handledNodes.missing.forEach(node => {
    msg.push({
      severity: "error",
      location: {
        file: editorPath,
        position: [node.startPosition, node.endPosition]
      },
      excerpt: "001: unhandled MISSING",
      description: "Is missing."
    })
  });

  // handledNodes.other.forEach(node => {
  //   msg.push({
  //     severity: "error",
  //     location: {
  //       file: editorPath,
  //       position: [node.startPosition, node.endPosition]
  //     },
  //     excerpt: "000: Unhandled syntax node",
  //     description: "I don't know what this is! Please raise an issue if one hasn't been already."
  //   })
  // });

  console.log(handledNodes);

  linter.setMessages(editorPath, msg);
}

module.exports = { EditorContainer };

function generateAllLints(handledNodes, node) {
  switch (node.type) {
    case "entry":
      handledNodes.entry.push(node);
      node.children.forEach(child => generateAllLints(handledNodes, child));
      break;
    case "comment_command":
    case "comment":
      handledNodes.comment.push(node);
      node.children.forEach(child => generateAllLints(handledNodes, child));
      break;
    case "junk":
      handledNodes.junk.push(node);
      break;
    case "string_command":
      handledNodes.string.push(node);
      node.children.forEach(child => generateAllLints(handledNodes, child));
      break;
    case "preamble_command":
      handledNodes.preamble.push(node);
      node.children.forEach(child => generateAllLints(handledNodes, child));
      break;
    case "ERROR":
      handledNodes.error.push(node);
      node.children.forEach(child => generateAllLints(handledNodes, child));
      break;
    case "MISSING":
      handledNodes.missing.push(node);
      node.children.forEach(child => generateAllLints(handledNodes, child));
      break;
    default:
      if (node.isNamed) { handledNodes.other.push(node); }
      node.children.forEach(child => generateAllLints(handledNodes, child));
  }
}
