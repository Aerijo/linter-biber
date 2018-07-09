In writing this linter, I first thought I could just hard code all the rules. Unfortunately, there's such a thing as "styles", and each one potentially adds it's own entries, fields, constraints, behaviour, etc.

Instead of adding support as I needed it (or was requested of it), I decided to write some functions that parsed the style files (I call them "model" files) and converted them into something generic that could be used in the linter. After some experimentation, I have settled (for the moment) on a three stage process.

### Template

First, the various model files are read and parsed into a `Template`. This template is basically a collation of the style commands, and not much is done to organise. The definition is probably incomplete too, as many (if not all) styles are meant to be extensions of the default style. Therefore, while it's not possible to make a style out of this directly, it is relatively small compared to the end goal, and can be serialised easily into a JSON file.

### ProtoStyle

This template, and an arbitrary number of others, can then be merged into a `ProtoStyle`. This is a complete definition of the style, and serialising into a JSON (directly at least) would be quite wasteful. As it is constructed, it will emit error messages that indicate when something unexpected has happened. At this point, entries and fields are assigned properties, but the actual `Entry` and `Field` classes are not used. The links between entries and their fields are just in name.

### Style

Finally, a `ProtoStyle` can be passed to a `Style` constructor to make the final product. This sets up the `Field` and `Entry` classes, and places all the constraints on them. As the goal is to make access to information fast, all the universal fields are also added to each entries set of fields.

### StyleRegistry

Just a container to keep track of styles and determine which ones to use, etc. It will (potentially in a future version) read in a meta data file that is created when the templates / styles are made, and use that to help decide which style an arbitrary `.bib` file is using.
