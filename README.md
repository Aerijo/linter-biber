# linter-biber
Atom linting package for biber.

Should be better than many tools out there (at least has potential to be), because it uses a full parser to read the file. Any linting mistakes should be reported to [the issues page](https://github.com/Aerijo/linter-biber/issues), or parsing issues to [the parser repo issues page](https://github.com/Aerijo/tree-sitter-biber/issues). If in doubt, just report to the linter repo and I'll deal with it.


~~Inspiration for the kinds of errors and warnings comes from https://github.com/Pezmc/BibLatex-Check/blob/master/biblatex_check.py~~
Largely diverged now I believe.

### Requirements
- [`atom-ide-ui`](https://atom.io/packages/atom-ide-ui), or
-  [`linter`](https://atom.io/packages/linter) and  [`linter-ui-default`](https://atom.io/packages/linter-ui-default).

### Settings

Currently, the style must be set manually. Any settings changes also require restarting Atom to be applied (including changing config files).

### Config

A goal of this package is to automatically generate the rules for a given grammar. This technically works, but many grammars define rules in places I haven't added support for yet. So, for the time being, you will probably need to make use of a config file to fine tune the expected entries and fields for your style.

There are two possible config sources: a global config, applied to all projects, and a local config that is only applied to a specific project.

_Note that local config support has not been added yet._

Both these configs use the same syntax. The file itself is a JSON, JS, CSON, or YAML format (or `.latexcfg` under the key `linter-biber`; not supported yet though).

At the top level object, there are two optional properties: `global` and `styles`. `global` immediately takes the config settings, while `styles` is an object where the keys are style names, and the values are config settings for that specific style. E.g. (a YAML example),

```yaml
global:
  lints:
    - ...
  fields:
    - ...
  entries:
    - ...

styles:
  apa:
    lints:
      - ...
    entries:
      - ...
  oxyear:
    lints:
      - ...
```

As shown above, the three recognised config keys are `lints`, `fields`, and `entries` (note all are optional). The order of these keys is irrelevant.

- `lints`: This takes commands of the form `watch 2, 5, 1, ...`, which tells the linter to enable the lints with these numbers (if currently disabled). Similarly, `ignore ...` will disable the lints with those numbers. The shorthand `w` and `i` can alternatively be used.
- `fields`: This takes commands of the following possible forms:
  - `(a|add) fieldName {derives=otherField, type=field, format=null, datatype=date, skipout, label, nullok}`
  - `(s|set) existingFieldName {...}`
  - `(r|remove) fieldName`
  - `alias aliasFieldName {actualField}`

  The `add` command makes a new field, overriding any existing field. The `derives` option lets you use the other field as the default properties, and alter them with `type`, `datatype`, `nullok`, etc. It's probably easiest to just derive from a similar class, instead of trying to set the other properties.

  The `set` command is the same as `add`, but it alters an existing field (so using `derives` will potentially change all it's properties).

  The `remove` command does what it says.

  The `alias` command lets you make a new name for an existing field. Unlike `add ... {derives=...}`, this will also update any constraints on the fields in entries. For example, `alias title {journaltitle}` will make it so that `title` is valid anywhere `journaltitle` is.

- `entries`: This takes commands of the form
  - `(a|add) entryName {derives=entry, skipout=false, add=[field1, field2, ...], remove=[f3, f4, ...]}`
  - `(s|set) entryName {...}`
  - `(r|remove) entryName`
  - `require entryName {all=[f1,...], some=[], one=[], rall=[], rsome=[], rone=[]}`

  `add`, `set`, and `remove` work much like with fields. The new options `add` and `remove` refer to the fields that can be expected within the entry. For example, `set article {add=publisher}` will make the `publisher` field valid inside an `article`. To specify multiple fields, you can use the syntax `add=[f1, f2, f3, ...]`. `remove` is similar, but marks the field as unexpected.

  `require` refers to the constraints on an entry. These corresponds to the warnings the say `expected all of ...` or `expected at least one of [...]`. To add always required fields, add them with the `all` key. To remove this kind of requirement, use the `rall` key (`r`(emove) `all`). To add "at least one of" fields, place all the possible fields in a group like this `some=[f1, f2, f3, ...]`. When at least one of these fields is present, the constraint is satisfied. To remove a field from all of the "some" types of constraint, use `rsome`. For example, `rsome=year` removes the option for `year`, and will make `date` required (if that "some" constraint was originally present). Finally, `one` and `rone` are the same as `some` and `rsome`, but the "some" condition is changed to "exactly one".

In general, the same option keys can be repeated as much as you like in a single command. This is how you might add multiple some conditionals in one command (though you could just split them over several commands if you prefer).

The execution order is as follows:
  - First, the `fields` property is evaluated, then `entries`.
  - All commands are evaluated top to bottom. All options in each command are evaluated left to right.

As an example, here's one that allows the `article` entry to contain `publisher`, and converts the requirement of both `title` and `journaltitle` to just at least one of them.

```yaml
global:
  entries:
    - set article {add=publisher}
    - require article {rall=[title, journaltitle], some=[title, journaltitle]}
```

And again, but in JSON
```json
{
  "global": {
    "entries": [
      "set article {add=publisher}",
      "require article {rall=[title, journaltitle], some=[title, journaltitle]}"
    ]
  }
}
```

Hopefully, future improvements in style definition parsing will reduce the need to rely on this. It should suffice for now though.
