const util = require("../resources/utilities.js");

module.exports = class Entry {
  constructor(name, props) {
    this.name = name;
    this.skipout = props.skipout || false;
    this.fields = props.fields || new Map(); // name -> Field
    this.constraints = props.constraints ||
      { mandatory: { all: [], some: [], one: [] }, conditional: [] };
  }

  addConstraint(constraint, style) {
    switch (constraint.type) {
      case "mandatory":
      const mandatory = this.constraints.mandatory;

      constraint.value.all.forEach(fieldName => {
        if (!this.fields.has(fieldName)) {
          this.fields.set(fieldName, style.getField(fieldName));
        }
        mandatory.all.includes(fieldName) || mandatory.all.push(fieldName);
      });

      constraint.value.some.forEach(fieldArray => {
        fieldArray.forEach(fieldName => {
          if (!this.fields.has(fieldName)) {
            this.fields.set(fieldName, style.getField(fieldName));
          }
        });

        const subsetFound = false;
        for (let i = 0; i < mandatory.some.length; i++) {
          const someFields = mandatory.some[i];
          const subset = util.setOverlap(someFields, fieldArray);

          if (subset === 2) { // 0: no, 1: #1 < #2, 2: #1 < #2
            mandatory.some[i] = fieldArray;
            subsetFound = true;
            break;
          }
        }
        if (!subsetFound) { mandatory.some.push(fieldArray); }
      });

      constraint.value.one.forEach(fieldArray => {
        fieldArray.forEach(fieldName => {
          if (!this.fields.has(fieldName)) {
            this.fields.set(fieldName, style.getField(fieldName));
          }
        });
        
        const supersetFound = false;
        for (let i = 0; i < mandatory.one.length; i++) {
          const oneFields = mandatory.one[i];
          const superset = util.setOverlap(someFields, fieldArray);

          if (superset === 1) { // 0: no, 1: #1 < #2, 2: #1 < #2
            mandatory.one[i] = fieldArray;
            supersetFound = true;
            break;
          }
        }
        if (!supersetFound) { mandatory.one.push(fieldArray); }
      });

      break;
      case "conditional":
      // optimisation is possible, but difficulty vs benefit is dismal
      this.constraints.conditional.push(constraint.value);
      break;
      case "data":
      console.error("Entry cannot handle data constraint! Ignoring...\n", constraint, this);
    }
  }

  /*
  * @param {Map<string,node>} field names -> syntax node
  * @returns {Object} An object with properties related to the failed constraints
  */
  checkConstraints(fields) {
    const mandatory = this.constraints.mandatory;
    const conditional = this.constraints.conditional;
    const missingAllFields = [];
    const missingSomeFields = [];
    const missingOneField = [];
    const tooManyFields = [];
    const failedConditionals = [];

    mandatory.all.forEach(fieldName => {
      if (!fields.has(fieldName)) {
        missingAllFields.push(fieldName);
      }
    });

    mandatory.some.forEach(fieldArray => {
      const hasSome = fieldArray.some(fieldName => fields.has(fieldName));
      if (!hasSome) {
        missingSomeFields.push(fieldArray);
      }
    });

    mandatory.one.forEach(fieldArray => {
      let seenField = false;
      for (let i = 0; i < fieldArray.length; i++) {
        if (fields.has(fieldArray[i])) {
          if (seenField) {
            tooManyFields.push(fieldArray);
            return;
          } else {
            seenField = true;
          }
        }
      }

      if (!seenField) {
        missingOneField.push(fieldArray);
      }

    });

    conditional.forEach(([antecedent, consequent]) => {
      let antSatisfied;
      switch (antecedent.required) {
        case "all":
        antSatisfied = antecedent.fields.every(fieldName => fields.includes(fieldName));
        break;
        case "one":
        // not technically correct, but I'm not refactoring right now. Sue me.
        antSatisfied = antecedent.fields.some(fieldName => fields.includes(fieldName));
        break;
        case "none":
        antSatisfied = antecedent.fields.every(fieldName => !fields.includes(fieldName));
        break;
      }
      if (!antSatisfied) { return; }

      let conSatisfied;
      switch (consequent.required) {
        case "all":
        conSatisfied = consequent.fields.every(fieldName => fields.includes(fieldName));
        break;
        case "one":
        conSatisfied = consequent.fields.some(fieldName => fields.includes(fieldName));
        break;
        case "none":
        conSatisfied = consequent.fields.every(fieldName => !fields.includes(fieldName));
        break;
      }
      if (!conSatisfied) {
        // `Saw ${antecedent.required} of ${antecedent.fields.join(", ")}
        // and expected ${consequent.required} of ${consequent.fields.join(", ")}`
        failedConditionals.push([antecedent, consequent]);
      }
    });

    return {
      missingAllFields,
      missingSomeFields,
      missingOneField,
      tooManyFields,
      failedConditionals
    };
  }
};
