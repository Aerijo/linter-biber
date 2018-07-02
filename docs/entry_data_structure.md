In the bib file, we may encounter an entry like this
```
@article{key,
  AUTHOR = "me",
  TITLE = "Foo",
  YEAR = "2013"
}
```

When parsing this, we
  - Check the entry name
    - is non-empty [error]
    - is expected [warning]
      - check against default entries
      - check against all possible entries in the LaTeX installation
        - dynamically determine the bib style in use, through user settings and matches of unknown entries against the different styles
        - once determined, set it and only check against that style in future

  - Check the key
    - is non-empty [error]
    - has a trailing comma [error]
    - is ASCII [warning]
    - is non-duplicate [warning]

  - Check each field
    - name
      - is non-duplicate [warning]
      - is non-empty [error]
      - is expected [warning]
        - if the entry type matched a style, check against all of these (or just the determined style in use)
        - also check if default has entry, and the entry has field
      - misc checks [varied]
        - is deprecated (e.g., YEAR -> DATE) [info]
        - is special (e.g., crossrefs) [store]
    - value
      - is non-empty [info]
      - is valid
        - balanced braces / parens [error]
      - misc checks [varied]
        - correct date format [warning]
    - check trailing comma (if next node is a field / there is an error) [error]

  - Once first pass done,
    - check all required fields present [warning]
      - if crossrefs, then ignore
    - check for conflicting fields (e.g., YEAR, DATE) [warning]
