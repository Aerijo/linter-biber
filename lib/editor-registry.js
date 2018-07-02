const { CompositeDisposable } = require("atom");
const Linter = require("./linter.js");

/*
* This class is responsible for managing which editors
* get the linting. It will observe text editor creation,
* as well as grammar changes in these text editors.
*/

module.exports = class EditorRegistry {
  constructor(linterInterface) {
    this.linterInterface = linterInterface;
    this.editorDataByID = new Map();

    this.maxLines = atom.config.get("linter-biber.maxNumberOfLines");

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

    container.linter = new Linter(editor, this.linterInterface, this.ignoredLints, this.maxLines);
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
