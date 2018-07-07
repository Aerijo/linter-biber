class Field {
  constructor(name, parameters={}, style=null) {
    this.name = name;
    this.type = parameters.type;
    this.datatype = parameters.datatype;
    this.format = parameters.format;
    this.nullok = parameters.nullok;
    this.skipout = parameters.skipout;
    this.label = parameters.label;

    this.style = style;

    this.isAlias = parameters.isAlias || false;
    this.aliasName = parameters.aliasName || null;
  }
}


class Constraint {
  constructor(type) {
    this.type = type;
  }

  test() {
    return true;
  }
}


class Entry {
  constructor(name, properties={}, style=null) {
    this.fields = properties.fields || new Map(); // Map() name -> Field
    this.name = name; // string
    this.constraints = properties.constraints || []; // Array (Constraints)
    this.isAlias = properties.isAlias || false; // bool
    this.aliasName = properties.aliasName || null; // string
    this.skipOut = properties.skipOut || false;
    this.style = style;

    if (this.name.length === 0) { console.warn("Empty entry name!", this); }
  }

  addConstraint(constraint) {
    this.constraints.push(constraint);
  }

  addConstraints(constraints) {
    this.constraints += constraints;
  }

  addField(field) {
    this.fields.set(field.name, field);
  }

  addFields(fields) {
    fields.forEach(field => this.addField(field));
  }

  // This is the "main" entry, the passed entry only fills any gaps
  // E.g., we never change alias status, and don't change field status
  // unless it's completely absent
  mergeWith(entry) {
    entry.fields.forEach((field, name) => this.fields.has(name) || this.addField(field));
    this.addConstraints(entry.constraints);
  }
}


class Style {
  constructor(name, properties={}) {
    this.name = name,
    this.entries = properties.entries || new Map();
    this.fields = properties.fields || new Map();
    this.untypedFields = properties.untypedFields || new Map();
    this.universalFields = properties.universalFields || new Map();
    this.constants = properties.constants || new Set();
    this.standAlone = properties.standAlone || false;
    this.skipoutFields = new Map();

    this.fields.forEach(field => {
      field.style = this;
      if (field.skipout) {
        this.skipoutFields.set(field.name, field);
      }
    });

    this.entries.forEach(entry => entry.style = this);
  }

  copy() {
    const copy = new Style(this.entries, this.fields, this.universalFields);
    copy.constants = this.constants;
    copy.standAlone = this.standAlone;

    return copy;
  }

  mergeWith(additional) {
    const merged = main.copy();

    additional.fields.forEach((field, name) => {
      merged.fields.has(name) || merged.fields.set(name, entry);
    });

    additional.universalFields.forEach((field, name) => {
      merged.universalFields.has(name) || merged.universalFields.set(name, entry);
    });

    additional.entries.forEach((entry, name) => {
      merged.entries.has(name)
        ? merged.entries.get(name).mergeWith(entry)
        : merged.entries.set(name, entry);
    });



    return merged;
  }

  validate() {
    const missingFields = new Set();
    this.entries.forEach(entry => {
      entry.fields.forEach(field => {
        if (!this.fields.has(field)) { missingFields.add(field); }
      });
    });

    this.universalFields.forEach(field => {
      if (!this.fields.has(field)) { missingFields.add(field); }
    });

    if (missingFields.size > 0) {
      console.error("Missing fields!", missingFields);
      return false;
    }

    return true;
  }

  getEntry(entryName) {
    return this.entries.get(entryName);
  }
}

function constructStyleFromJSON(json) {
  const styleName = json.styleName;
  const styleProps = {
    entries: new Map(),
    fields: new Map(),
    untypedFields: new Map(),
    universalFields: new Map(),
    constants: new Set(),
    standAlone: json.standAlone || false,
    skipoutFields: new Map()
  };

  const fieldTypes = json.fieldTypes;
  const untypedFields = json.untypedFields;
  const fieldNames = Object.keys(fieldTypes);

  fieldNames.forEach(name => styleProps.fields.set(name, new Field(name, fieldTypes[name])));
  untypedFields.forEach(name => styleProps.fields.set(name, new Field(name, {})));

  const entryFields = json.entryFields;
  const entryNames = Object.keys(entryFields);
  entryNames.forEach(name => {
    const entryProperties = { fields: new Map(), constraints: [] };
    const expectedFieldNames = entryFields[name];

    expectedFieldNames.forEach(fieldName => {
      const field = styleProps.fields.get(fieldName);
      entryProperties.fields.set(fieldName, field);
    });

    styleProps.entries.set(name, new Entry(name, entryProperties));
  });

  json.universalFields.forEach(fieldName => {
    const field = styleProps.fields.get(fieldName);
    if (!field) { console.error("missing field!", fieldName); return; }
    styleProps.universalFields.set(fieldName, field);
  });

  return new Style(styleName, styleProps);
}

function getDefaultStyle() {
  return constructStyleFromJSON(require("./cite_styles/default_datamodel.json"));
}

module.exports = { getDefaultStyle, constructStyleFromJSON, Style, Field, Constraint, Entry };
