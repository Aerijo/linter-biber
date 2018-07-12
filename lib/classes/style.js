const Entry = require("./entry.js");
const Field = require("./field.js");

module.exports = class Style {
  constructor(name, protoStyle) {
    this.name = name;
    this.constants = new Map();
    this.entries = new Map();
    this.fields = new Map();
    this.entryFields = new Map();
    this.universalFields = new Map();
    this.untypedFields = new Map();

    this.buildStyleFromProtoStyle(protoStyle);
  }

  updateFromConfig(config) {
    
  }

  getIdentifierValue(identifier) {
    return null;
  }

  getEntry(name) {
    return this.entries.get(name);
  }

  getField(name) {
    if (!this.fields.has(name)) {
      const defaultField = new Field(name);
      this.fields.set(name, defaultField);
      this.untypedFields.set(name, defaultField);
    }
    return this.fields.get(name);
  }

  addField(name, props) {
    this.fields.set(name, new Field(name, props));
  }

  addEntry(entryName, props, proto) {
    const skipout = props.skipout;
    const fieldNames = proto.entryFields.get(entryName) || new Set();

    const fields = new Map();
    fieldNames.forEach(name => fields.set(name, this.getField(name)));
    this.universalFields.forEach((field, name) => fields.set(name, field));


    const constraints = null; // we add these later
    const entry = new Entry(entryName, { skipout, fields, constraints });

    this.entries.set(entryName, entry);
  }

  buildStyleFromProtoStyle(proto) {
    // Constants don't need much/any processing
    this.constants = proto.constants;

    // Create the Fields; these will be the "foundation"
    // for the other classes, so we make all of them first
    proto.fields.forEach((props, name) => this.addField(name, props));

    // Make Fields for untyped universal fields
    proto.universalFields.forEach(name => {
      const field = this.getField(name);
      this.universalFields.set(name, field);
    });

    // Now we have fields, we can make entries with them
    proto.entries.forEach((props, name) => this.addEntry(name, props, proto));

    // Check that we don't have any undeclared entries
    proto.entryFields.forEach((fields, name) => {
      if (!this.entries.has(name)) {
        console.error("Undeclared entry:", name);
      }
    });

    proto.entryConstraints.forEach((constraints, name) => {
      const entry = this.entries.get(name);
      constraints.forEach(constraint => {
        switch (constraint.type) {
          case "mandatory":
          case "conditional":
          entry.addConstraint(constraint, this);
          break;
          case "data":
          console.error("Unhandled data constraint for entry", name, constraint);
          break;
        }
      });
    });

    proto.universalConstraints.forEach(constraint => {
      switch (constraint.type) {
        case "mandatory":
        case "conditional":
        console.error(`Unhandled universal ${constraint.type} constraint`, constraint);
        break;
        case "data":
        const fieldNames = constraint.value.fields;
        fieldNames.forEach(name => {
          const field = this.getField(name);
          field.addConstraint(constraint);
        });
        break;
      }
    });
  }
};
