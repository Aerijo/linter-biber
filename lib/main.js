const { CompositeDisposable } = require("atom");

const EditorRegistry = require("./editor-registry.js");
const { getStyleConfig } = require("./load-style-config.js");
const styleNames = require("./cite_styles/meta/meta.json").styles;

module.exports = {
  activate() {
    atom.config.set("");
    this.disposables = new CompositeDisposable();
    this.globalStyleConfig = null;
    this.editorRegistry = null;
  },

  deactivate() {
    this.disposables.dispose();
  },

  consumeIndie(registerIndie) {
    const linter = registerIndie({ name: 'Biber' });

    const useGlobalConfig = atom.config.get("linter-biber.configFile.useGlobalConfig");
    if (useGlobalConfig) {
      const configPath = atom.config.get("linter-biber.configFile.globalConfigPath");
      this.globalStyleConfig = getStyleConfig(configPath);
    }

    this.editorRegistry = new EditorRegistry(linter, this.globalStyleConfig);

    this.disposables.add(linter, this.editorRegistry);

    this.disposables.add(
      atom.workspace.observeTextEditors(editor => {
        this.editorRegistry.add(editor);
      })
    );
  }
};
