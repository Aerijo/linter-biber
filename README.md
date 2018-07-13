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
  - The global config is applied, then the local one, then the ignored lints in the settings.
  - In a config file, the global property is applied first, then the style specific property.
  - First, the `fields` property is evaluated, then `entries`.
  - All commands are evaluated top to bottom. All options in each command are evaluated left to right.

In conflicts, future commands will override earlier ones.

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


### Numbering

The numbers are a mess right now, and will not be permanent. I normally just used the first number I could think of that (probably) hadn't been used somewhere else. All numbers are less than 1000, and you don't need to include the leading `0`'s when adding rules about watching and ignoring.

With that said, here's a summary of the current lints and their numbers:

- 000: An error thrown by the parser, that is not handled by rules in this linter. Note that the parser will attempt to continue parsing, so it should not be fatal.
- 001: Top level junk. Junk behave like a comment, but is not marked with a `%`. Ignoring this is fine, and wil not affect your program (in all sane cases). This warning is largely here because biber throws a warning about junk in the log file (`\jobname.blg`)
- 002: The entry name cannot be found. I don't think this will ever throw, because the parser creates and empty node for the entry name regardless.
- 004: Missing entry name. This is the one that will most likely throw.
- 005: Unexpected entry name. Thrown when the entry name has not been declared in the list of valid entries for the style.
- 006: Duplicate field. For when a given entry already has the field (done only by name, aliases are not supported for this)
- 007: Unexpected field. When the entry has not been declared as supporting the field.
- 011: Duplicate key. The key has been seen in an entry above, in the position `(line:column)`
- 012: Empty key name. The key is empty, which throws an error when running biber
- 013: Non-ASCII characters in key. While these characters may work if using XeTeX or similar, it may reduce compatibility with other engines. Relevant if you're using a shared bib file across multiple projects.
- 014: \@COMMENT commands can break with BiBTeX. This is added because the original spec, BiBTeX, does not support explicit comments. The closest it gets is reading the name of `@comment`, and immediately going back into "looking for an entry" mode. If you have an `@` inside one of these, it could cause problems if running with `BiBTeX` (which is admittedly very unlikely).
- 019: Unhandled error in entry field. Similar to 000, but hey--- at least it knows it's inside an entry.
- 020: Missing closing delimiter. For when the parser has detected an error, and it's most likely because you forgot to close something.
- 021: Unbalanced { | Unbalanced }. Note there's no way to escape characters, so use a command like `\textbackslash` or TeX sorcery if necessary.
- 022: Unbalanced ). Parentheses can be used to deliminate a `@comment` command. Basically, they need to be balanced, and when the closing `)` is seen, any braces must also be balanced.
- 034: Missing required fields. All of these have been indicated as required by the style config. Until better style rules parsing is implemented, you may want to use a config file to customise this. (Corresponds to `all` in config)
- 035: Missing at least one field of. Similar to 034. (Corresponds to `some` in config)
- 036: Missing one of. Similar to 034. (Corresponds to `one` in config)
- 037: Too many of. Similar to 034. (Corresponds to `one` in config)
- 038: Failed conditional. A prerequisite combination of fields was met, but the condition failed. Not currently possible to add / customise.
- 042: Field name is missing. Maybe you added a comma or equals sign where you weren't supposed to?
- 065: Invalid range format. The field has been marked as a range, and the value did not match expectations.
- 067: Invalid date format. The field has been marked as a date, and the value is not what is expected. Would you believe this is the reason I wrote this entire linter?
- 068: Invalid pattern match. The value was supposed to match the shown ([regex](https://www.marksanborn.net/howto/learning-regular-expressions-for-beginners-the-basics/)) pattern, but failed.
- 071: Cannot find key. Unlikely to throw, as empty key is still "found" (see 012)
- 082: Empty field value not allowed. The field has been marked as `nullok=false`, and the value has been detected as empty.
- 098: Error when looking for node. The linter was looking for a node, but encountered a syntax error while it searched.
- 099: Missing comma after key. This throws an error with biber, regardless of if there are no fields.
- 997: Missing node. If the node is marked as an error by the parser, and it has 0 width.
- 998: Error encountered. That's not supposed to be there...
- 999: foo. When I forget to give a lint a number.
