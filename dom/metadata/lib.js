export function typeName(typeId, typeRegistry) {
  const type = typeRegistry.get(typeId);
  switch (type.type) {
    case "Compact": {
      return `Compact<${typeName(type.store, typeRegistry)}>`;
    }
    case "Enum": {
      return `${type.name} (Enum)`;
    }
    case "Struct": {
      return `${type.name} (Struct)`;
    }
    case "Option": {
      return `Option<${typeName(type.store, typeRegistry)}>`;
    }
    case "List": {
      return listTypeName(type, typeRegistry);
    }
    case "Tuple": {
      return `(${type.fields
        .map((field) => typeName(field.field, typeRegistry))
        .join(", ")})`;
    }
    default: {
      return type.type;
    }
  }
}

export function listTypeName(listType, typeRegistry) {
  if (listType.length) {
    return `[${typeName(listType.store, typeRegistry)}; ${listType.length}]`;
  } else {
    return `List<${typeName(listType.store, typeRegistry)}>`;
  }
}

export function fieldName(field, typeRegistry) {
  if (field.name) {
    return `${field.name} (${typeName(field.field, typeRegistry)})`;
  }

  return typeName(field.field, typeRegistry);
}

export function hasFields(typeId, typeRegistry) {
  const type = typeRegistry.get(typeId);
  if (type.type === "Struct" || type.type === "Enum") {
    return true;
  }

  if (type.type === "List" || type.type === "Option") {
    return hasFields(type.store, typeRegistry);
  }

  if (type.type === "Tuple") {
    return type.fields.some((field) => hasFields(field.field, typeRegistry));
  }
}

export function fieldTypeList(typeId, typeRegistry) {
  const list = document.createElement("ul");
  const type = typeRegistry.get(typeId);
  switch (type.type) {
    case "Enum": {
      for (const variant of type.variants) {
        const variantItem = document.createElement("li");
        variantItem.innerText = variant.name;
        list.appendChild(variantItem);
        if (variant.fields?.length) {
          const fields = document.createElement("ul");
          for (const field of variant.fields) {
            const fieldItem = document.createElement("li");
            fieldItem.innerText = typeName(field.field, typeRegistry);
            fields.appendChild(fieldItem);
            // TODO: listing inner fields causes stack overflow
          }

          list.appendChild(fields);
        }
      }

      return list;
    }
    case "Struct": {
      for (const field of type.fields) {
        const fieldItem = document.createElement("li");
        fieldItem.innerText = `${field.name} (${typeName(
          field.field,
          typeRegistry
        )})`;
        list.appendChild(fieldItem);
        if (hasFields(field.field, typeRegistry)) {
          list.appendChild(fieldTypeList(field.field, typeRegistry));
        }
      }

      return list;
    }
    case "Option":
    case "List": {
      return fieldTypeList(type.store, typeRegistry);
    }
    case "Tuple": {
      for (const field of type.fields) {
        if (!hasFields(field.field, typeRegistry)) {
          continue;
        }

        list.appendChild(
          document.createTextNode(typeName(field.field, typeRegistry))
        );
        list.appendChild(fieldTypeList(field.field, typeRegistry));
      }

      return list;
    }
  }
}

export function typeDetails(typeId, typeRegistry) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  details.appendChild(summary);
  const typeTag = document.createElement("span");
  typeTag.className = "h4";
  typeTag.innerText = "Type: ";
  summary.appendChild(typeTag);
  const name = document.createTextNode(typeName(typeId, typeRegistry));
  summary.appendChild(name);
  if (hasFields(typeId, typeRegistry)) {
    details.appendChild(fieldTypeList(typeId, typeRegistry));
  }

  return details;
}

export function storageMapType(mapType, typeRegistry) {
  const key = typeName(mapType.key, typeRegistry);
  const value = typeName(mapType.value, typeRegistry);
  const hasherNames = mapType.hashers.join(", ");
  const hashers = `${
    mapType.hashers.length > 1 ? `(${hasherNames})` : hasherNames
  }`;

  const typeTag = document.createElement("span");
  typeTag.className = "h4";
  typeTag.innerText = "Type: ";
  const name = document.createTextNode(`Map<${key}, ${value}, ${hashers}>`);
  if (hasFields(mapType.value, typeRegistry)) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    details.appendChild(summary);
    summary.appendChild(typeTag);
    summary.appendChild(name);
    details.appendChild(fieldTypeList(mapType.value, typeRegistry));

    return details;
  } else {
    const type = document.createElement("div");
    type.appendChild(typeTag);
    type.appendChild(name);
    return type;
  }
}

export function inputForField(field, typeRegistry) {
  const type = typeRegistry.get(field.field);
  switch (type.type) {
    case "Enum": {
      const inputId = `${field.name}-input`;
      const fieldInput = document.createElement("div");
      const fieldLabel = document.createElement("label");
      fieldLabel.setAttribute("for", inputId);
      fieldLabel.innerText = fieldName(field, typeRegistry) + ": ";
      fieldInput.appendChild(fieldLabel);
      const input = document.createElement("select");
      const fields = {};
      for (let idx = 0; idx < type.variants.length; ++idx) {
        const variant = type.variants[idx];
        const option = document.createElement("option");
        option.value = idx;
        option.innerText = variant.name;
        input.appendChild(option);
        if (!variant.fields) {
          continue;
        }

        const inputs = [];
        const render = () => {
          inputs.length = 0;
          const variantFields = document.createElement("div");
          for (let idx = 0; idx < variant.fields.length; ++idx) {
            const variantField = variant.fields[idx];
            const fieldInput = inputForField(variantField, typeRegistry);
            inputs.push(fieldInput);
            variantFields.appendChild(fieldInput.input);
          }

          return variantFields;
        };

        fields[idx] = { inputs, render };
      }

      input.addEventListener("change", () => {
        fieldInput.children[2]?.remove();
        if (fields[input.value]) {
          fieldInput.appendChild(fields[input.value].render());
        }
      });

      input.id = inputId;
      fieldInput.appendChild(input);
      if (fields[0]) {
        fieldInput.appendChild(fields[0].render());
      }

      return {
        input: fieldInput,
        value: () => {
          const index = parseInt(input.value);
          return {
            index,
            fields: fields[index]?.inputs.map((field) => field.value()),
          };
        },
      };
    }
    default: {
      const inputId = `${field.name}-input`;
      const fieldInput = document.createElement("div");
      const fieldLabel = document.createElement("label");
      fieldLabel.setAttribute("for", inputId);
      fieldLabel.innerText = fieldName(field, typeRegistry) + ": ";
      fieldInput.appendChild(fieldLabel);
      const input = document.createElement("input");
      input.id = inputId;
      fieldInput.appendChild(input);

      return { input: fieldInput, value: () => input.value };
    }
  }
}

export function eventsList(events) {
  const eventList = document.createElement("ul");
  for (const rawEvent of events) {
    const event = rawEvent.event.fields[0];
    const item = document.createElement("li");
    item.innerText = event.name;
    if (!event.fields?.length) {
      eventList.appendChild(item);
      continue;
    }

    const fieldList = document.createElement("ul");
    for (const field of event.fields) {
      if (typeof field === "object") {
        for (const property in field) {
          const propertyItem = document.createElement("li");
          propertyItem.innerText = field[property];
          fieldList.appendChild(propertyItem);
        }
      } else {
        const fieldItem = document.createElement("li");
        fieldItem.innerText = field;
        fieldList.appendChild(fieldItem);
      }
    }

    item.appendChild(fieldList);
    eventList.appendChild(item);
  }

  return eventList;
}

export function valueList(obj) {
  const fields = document.createElement("ul");

  for (const field in obj) {
    const item = document.createElement("li");
    if (typeof obj[field] === "object") {
      item.innerText = field;
      const innerFields = valueList(obj[field]);
      item.appendChild(innerFields);
    } else {
      item.innerText = `${field}: ${obj[field]}`;
    }

    fields.appendChild(item);
  }

  return fields;
}
