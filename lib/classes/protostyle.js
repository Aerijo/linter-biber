module.exports = class ProtoStyle {
  constructor(templates) {
    this.constants = new Map();            // name      -> constant
    this.entries = new Map();              // name      -> properties
    this.fields = new Map();               // name      -> properties
    this.entryFields = new Map();          // entryName -> Set (fieldNames)
    this.universalFields = new Set();      // names
    this.entryConstraints = new Map();     // entryName -> Set (constraints)
    this.universalConstraints = new Set(); // constraints

    if (templates.constructor !== Array) {
      templates = [...arguments];
    }

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      if (template === null) { continue; }
      this.addFromTemplate(template);
    }

    console.log(this);
  }

  addFromTemplate(template) {
    template.constants.forEach(constant => {
      const name = constant.name;
      const props = { type: constant.type, value: constant.value };
      this.constants.set(name, props);
    });

    template.entries.forEach(entryData => {
      const names = entryData.names;
      const properties = entryData.properties;
      names.forEach(name => this.entries.set(name, properties));
    });

    template.fields.forEach(fieldData => {
      const names = fieldData.names;
      const properties = fieldData.properties;
      names.forEach(name => this.fields.set(name, properties));
    });

    const entryFields = template.entryFields;
    entryFields.forEach(([name, fields]) => {
      if (this.entryFields.has(name)) {
        const existingFields = this.entryFields.get(name);
        fields.forEach(field => existingFields.add(field));
      } else {
        this.entryFields.set(name, new Set(fields));
      }
    });

    template.universalFields.forEach(field => this.universalFields.add(field));

    template.entryConstraints.forEach(constraintData => {
      const names = constraintData.entries;
      const constraints = constraintData.constraints;
      names.forEach(name => {
        if (this.entryConstraints.has(name)) {
          const existingConstraints = this.entryConstraints.get(name);
          constraints.forEach(constraint => existingConstraints.add(constraint));
        } else {
          this.entryConstraints.set(name, new Set(constraints));
        }
      });
    });

    template.universalConstraints.forEach(constraint => {
      this.universalConstraints.add(constraint);
    });
  }
};
