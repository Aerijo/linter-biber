module.exports = class ProtoStyle {
  constructor(templates, styleConfig=null) {
    this.name;
    this.constants = new Map();            // name      -> constant
    this.entries = new Map();              // name      -> properties
    this.fields = new Map();               // name      -> properties
    this.entryFields = new Map();          // entryName -> Set (fieldNames)
    this.universalFields = new Set();      // names
    this.entryConstraints = new Map();     // entryName -> Set (constraints)
    this.universalConstraints = new Set(); // constraints

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      if (template === null) { continue; }
      this.name = template.name;
      this.addFromTemplate(template);
    }

    if (styleConfig) {
      if (styleConfig.global) {
        this.applyConfig(styleConfig.global);
      }
      if (styleConfig.styles.has(this.name)) {
        this.applyConfig(styleConfig.styles.get(this.name));
      }
    }
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

  applyConfig(config) {
    if (config.fields) {
      for (let i = 0; i < config.fields.length; i++) {
        const command = config.fields[i];
        this.applyFieldCommand(command);
      }
    }

    if (config.entries) {
      for (let i = 0; i < config.entries.length; i++) {
        const command = config.entries[i];
        this.applyEntryCommand(command);
      }
    }
  }

  applyFieldCommand(command) {
    const fieldName = command.name.toUpperCase();
    let props;
    switch (command.type) {
      case "alias":
      const aliases = command.options.map(([key, _]) => key.toUpperCase());
      const props = this.fields.get(fieldName);
      if (!props) { return; }
      aliases.forEach(alias => this.fields.set(alias, props));
      this.entryFields.forEach(fields => !fields.has(fieldName) || aliases.forEach(a => fields.add(a)));
      !this.universalFields.has(fieldName) || aliases.forEach(a => this.universalFields.add(a));
      this.entryConstraints.forEach(constraints => {
        constraints.forEach(constraint => {
          if (constraint.type !== "mandatory") { return; }
          const index = constraint.value.all.indexOf(fieldName);
          if (index > -1) {
            constraint.value.all.splice(index, 1); // remove element
            constraint.value.some.push([fieldName, ...aliases]);
          }
        });
      });
      break;

      case "set":
      props = this.fields.get(fieldName);
      if (!props) { console.error(`No field to set for ${fieldName}`); return; }
      case "add":
      if (!props) {
        props = {
          type: null,
          format: null,
          datatype: null,
          nullok: false,
          skipout: false,
          label: false
        };
      }
      command.options.forEach(([key, value]) => {
        key = key.toLowerCase();
        if (typeof value === "string") { value = value.toLowerCase(); }
        switch (key) {
          case "derives":
          const newProps = this.fields.get(value);
          if (!newProps) {
            console.error(`No field ${value} to derive from`);
            return;
          }
          props = newProps;
          break;
          case "type":
          case "format":
          case "datatype":
          props[key] = value;
          break;
          case "nullok":
          case "skipout":
          case "label":
          props[key] = value !== "false";
          break;
        }
      });
      this.fields.set(fieldName, props);
      break;
      case "remove":
      this.fields.delete(fieldName);
      this.universalfields.delete(fieldName);
      this.entryFields.forEach(fieldSet => {
        fieldSet.delete(fieldName);
      });
      break;
      default: console.error("Unknown command", command.type, "in", command); return;
    }
  }

  applyEntryCommand(command) {
    const entryName = command.name.toUpperCase();
    let entryFields;
    let entryProps;
    switch(command.type) {
      case "require":
      command.options.forEach(([key, value]) => {
        if (value.length === 0) { return; }
        value = value.toUpperCase().split(/\s*,\s*/);
        let existingConstraints;
        switch (key) {
          case "all":
          case "some":
          case "one":
          existingConstraints = this.entryConstraints.get(entryName);
          if (!existingConstraints) { existingConstraints = new Set(); }
          const constraint = {
            type: "mandatory",
            value: {
              all: [],
              some: [],
              one: []
            }
          };
          if (key === "all") {
            constraint.value[key].push(...value);
          } else {
            constraint.value[key].push(value);
          }
          existingConstraints.add(constraint);
          break;
          case "rall":
          case "rsome":
          case "rone":
          existingConstraints = this.entryConstraints.get(entryName);
          if (!existingConstraints) { return; }
          existingConstraints.forEach(constraint => {
            if (key === "rall") {
              value.forEach(name => {
                let index = constraint.value.all.indexOf(name);
                if (index > -1) {
                  constraint.value.all.splice(index, 1);
                }
              });
            } else {
              constraint.value[key.slice(1)].forEach(fieldSet => {
                value.forEach(name => {
                  let index = fieldSet.indexOf(name);
                  if (index > -1) {
                    fieldSet.splice(index, 1);
                  }
                });
              });
            }
          });
          break;
        }
      });
      break;
      case "remove":
      this.entries.delete(entryName);
      this.entryFields.delete(entryName);
      this.entryConstraints.delete(entryName);
      break;
      case "set":
      entryFields = this.entryFields.get(entryName);
      entryProps = this.entries.get(entryName);
      if (!entryProps) { console.error("Cannot set nonexistent entry"); }
      case "add":
      if (!entryProps) {
        entryProps = { skipout: false };
      }
      command.options.forEach(([key, value]) => {
        key = key.toLowerCase();
        if (typeof value === "string") { value = value.toUpperCase(); }
        switch (key) {
          case "skipout":
          entryProps.skipout = value !== "false";
          break;
          case "derives":
          entryFields = this.entryFields.get(value);
          entryProps = this.entries.get(value);
          break;
          case "add":
          if (typeof value !== "string") { console.error("NO STRING"); return; }
          if (!entryFields) { entryFields = new Set(); }
          value.split(/\s*,\s*/).forEach(field => entryFields.add(field));
          break;
          case "remove":
          // TODO: Support changing universal fields as well
          if (typeof value !== "string") { return; }
          if (!entryFields) { return; }
          value.split(/\s*,\s*/).forEach(field => entryFields.delete(field));
          break;
        }
      });
      if (!entryFields || entryFields.size === 0) {
        this.entryFields.delete(entryName);
      } else {
        this.entryFields.set(entryName, entryFields);
      }
      this.entries.set(entryName, entryProps);
    }
  }
};
