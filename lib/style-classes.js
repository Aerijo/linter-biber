function buildStyleFromTemplate(template, defaultTemplate=null) {
  if (defaultTemplate) {
    if (template.resetPriorEntries) { defaultTemplate.entries = []; }
    if (template.resetPriorFields) {
      defaultTemplate.fields = [];
      defaultTemplate.universalFields = [];
    }
    if (template.resetPriorEntryFields) { defaultTemplate.entryFields = {}; }
    if (template.resetPriorConstraints) {
      defaultTemplate.entryConstraints = [];
      defaultTemplate.universalConstraints = [];
    }
  }

  const protoStyle = buildProtoStyleFromTemplates([defaultTemplate, template]);
  const style = buildStyleFromProtoStyle(protoStyle);
  return style;
}
