# linter-biber
Atom linting package for biber.

Will update with comprehensive list of current and planned lints. For rough guide, see `/docs/messages.md`. I'm also considering stylistic lints, such as spacing and capitalisation.

Should be better than many tools out there (at least has potential to be), because it uses a full parser to read the file. Any mistakes should be reported to [the issues page](https://github.com/Aerijo/linter-biber/issues), or parsing issues to [the parser repo issues page](https://github.com/Aerijo/tree-sitter-biber/issues). If in doubt, just report to this one's and I'll deal with it.

Requires [`linter`](https://atom.io/packages/linter) and your choice of [`linter-ui-default`](https://atom.io/packages/linter-ui-default), [`atom-ide-ui`](https://atom.io/packages/atom-ide-ui) or equivalent.

Inspiration for the kinds of errors and warnings comes from https://github.com/Pezmc/BibLatex-Check/blob/master/biblatex_check.py
