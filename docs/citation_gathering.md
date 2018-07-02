- Gather default entries (these will most likely be used by all styles)
- Gather the new entries of each style, and their fields
- Gather the new fields of each style, and the entries they apply to.

Example field object:
```js
let field = {
  id: 12, // so same name fields with different properties can be used
  name: "title",
  requiredEntries: ["article", "book"],
  alternatives: ["booktitle"],
}
```
