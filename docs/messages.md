## Planned Info:
- Unrecognised entry type X
- Field alias in use
- Year is deprecated by Date, which is better for metadata stuff and more general X

## Planned Warnings
- Junk (disabled by default though) X
- Duplicate keys X
- Missing fields X
- Unknown fields (possibly typos) X
- Non-ASCII identifiers (enabled by default; it's probably bad to have them, even if they're allowed) X
- BiBTeX incompatibility (disabled by default); e.g., things like a comment block with @ signs - done comment blocks
- Undefined macros
- Invalid date format (I personally want this one very much) - should be `yyyy-mm-ddThh:nn[+-][hh[:nn]Z]` or (for range) `yyyy-mm-ddThh:nn[+-][hh[:nn]Z]/yyyy-mm- ddThh:nn[+-][hh[:nn]Z]` X

- Range fields
- Both `year` and `date` field present (date will take precedence over year, unless the date format is invalid) X
- Legacy field names / aliases

## Planned Errors
- Incomplete entries (e.g., missing braces or key) - done key
- Anything else not caught but marked as ERROR or MISSING by parser


## Planned behaviour
- Also parse the log (`blg`) file for warnings and errors that I missed. Maybe notify user if they want to raise an issue to add support for it?

- Either dynamically scrape possible entries and fields from users installation, or do it myself and add them. That should help reduce false "unrecognised field" warnings.

- Lint style as well
