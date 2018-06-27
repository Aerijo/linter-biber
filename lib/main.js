const { CompositeDisposable } = require("atom");

const { EditorRegistry } = require("./linter-biber.js");

module.exports = {
  config: {
    ignoredLints: {
      type: "array",
      default: ["14", "1", "16", "7", "5"],
      items: { type: "string" }
    },
    maxNumberOfLines: {
      type: "integer",
      default: 30000,
      description: "Use this to customise roughly how many lines will be linted before giving up. Restart required to apply changes"
    }
  },

  activate() {
    console.log("activated linter");
    this.disposables = new CompositeDisposable();
  },

  deactivate() {
    this.disposables.dispose();
  },

  consumeIndie(registerIndie) {
    const linter = registerIndie({
      name: 'Biber'
    });

    const editorContainer = new EditorRegistry(linter);

    this.disposables.add(linter, editorContainer);

    this.disposables.add(
      atom.workspace.observeTextEditors(editor => {
        editorContainer.add(editor);
      })
    );
  }
};
