## Planned Info:
- Unrecognised entry type
- Field alias in use
- Year is deprecated by Date, which is better for metadata stuff and more general

## Planned Warnings
- Junk (disabled by default though)
- Duplicate keys
- Missing fields
- Unknown fields (possibly typos)
- Non-ASCII identifiers (enabled by default; it's probably bad to have them, even if they're allowed)
- BiBTeX incompatibility (disabled by default); e.g., things like a comment block with @ signs
- Undefined macros
- Invalid date format (I personally want this one very much) - should be `yyyy-mm-ddThh:nn[+-][hh[:nn]Z]` or (for range) `yyyy-mm-ddThh:nn[+-][hh[:nn]Z]/yyyy-mm- ddThh:nn[+-][hh[:nn]Z]`

- Range fields
- Both `year` and `date` field present (date will take precedence over year, unless the date format is invalid)
- Legacy field names

## Planned Errors
- Incomplete entries (e.g., missing braces or key)
- Anything else not caught but marked as ERROR or MISSING by parser


## Planned behaviour
- Also parse the log (`blg`) file for warnings and errors that I missed. Maybe notify user if they want to raise an issue to add support for it?
