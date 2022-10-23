"use strict";

import {
  eventsList,
  fieldTypeList,
  hasFields,
  inputForField,
  storageMapType,
  typeDetails,
  typeName,
  valueList,
} from "/dom/metadata/lib.js";
import { decode } from "/lib/scale.js";

export default class MetadataComponent extends HTMLElement {
  static #template;
  static {
    this.#template = document.getElementById("metadata").content;
  }

  #shadowRoot;

  /**
   * @typedef { import("/lib/metadata.js").default } Metadata
   * @type { Metadata }
   */
  #metadata;

  #context;

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({ mode: "closed" });
    this.#shadowRoot.appendChild(MetadataComponent.#template.cloneNode(true));
  }

  async setContext(context) {
    this.#context = context;
    this.#metadata = await this.#context.metadata();

    const types = this.#metadata.types;
    const eventStore = this.#metadata.pallets[0].storage.find(
      (store) => store.name === "Events"
    );
    for (const pallet of this.#metadata.pallets) {
      const hr = document.createElement("hr");
      this.#shadowRoot.appendChild(hr);

      const template = this.#shadowRoot
        .getElementById("pallet")
        .content.cloneNode(true);
      template.getElementById("name").innerText = pallet.name;
      template.querySelector(
        "details"
      ).id = `pallet-${pallet.name.toLowerCase()}`;

      const hasStorage = pallet.storage && pallet.storage.length;

      const constants = template.getElementById("constants");
      if (!pallet.constants.length) {
        constants.remove();
      } else {
        if (hasStorage) {
          const hr = document.createElement("hr");
          hr.className = "light";
          constants.after(hr);
        }

        for (const constant of pallet.constants) {
          const item = this.#shadowRoot
            .getElementById("constant")
            .content.cloneNode(true);
          item.getElementById("name").innerText = constant.name;
          const docs = item.getElementById("docs");
          for (const doc of constant.docs) {
            const div = document.createElement("div");
            div.innerText = doc;
            docs.appendChild(div);
          }

          const type = item.getElementById("type");
          if (hasFields(constant.type, types)) {
            type.appendChild(typeDetails(constant.type, types));
          } else {
            const typeTag = document.createElement("span");
            typeTag.className = "h4";
            typeTag.innerText = "Type: ";
            type.appendChild(typeTag);
            const name = document.createTextNode(
              typeName(constant.type, types)
            );
            type.appendChild(name);
          }

          const constVal = decode(constant.value, constant.type, types);
          if (!constVal) {
            item.getElementById("value-header").remove();
          } else {
            const value = document.createElement("li");
            if (typeof constVal.value === "object") {
              value.innerText = constant.name;
              const fields = valueList(constVal.value);
              value.appendChild(fields);
            } else {
              value.innerText = constVal.value;
            }

            item.getElementById("value").appendChild(value);
          }

          constants.appendChild(item);
        }
      }

      const hasEvents = pallet.events && pallet.events.length;

      const storage = template.getElementById("storage-items");
      if (hasStorage) {
        if (hasEvents) {
          const hr = document.createElement("hr");
          hr.className = "light";
          storage.after(hr);
        }

        for (const store of pallet.storage) {
          const item = this.#shadowRoot
            .getElementById("storage-item")
            .content.cloneNode(true);
          item.getElementById("name").innerText = store.name;
          const docs = item.getElementById("docs");
          for (const doc of store.docs) {
            const div = document.createElement("div");
            div.innerText = doc;
            docs.appendChild(div);
          }

          let field;
          const type = item.getElementById("type");
          const form = item.getElementById("query-form");
          if (store.type) {
            if (!hasFields(store.type, types)) {
              const typeTag = document.createElement("span");
              typeTag.className = "h4";
              typeTag.innerText = "Type: ";
              type.appendChild(typeTag);
              const name = document.createTextNode(typeName(store.type, types));
              type.appendChild(name);
            } else {
              type.appendChild(typeDetails(store.type, types));
            }
          } else if (store.map) {
            type.appendChild(storageMapType(store.map, types));

            const fieldInput = document.createElement("div");
            const fieldLabel = document.createElement("label");
            fieldInput.appendChild(fieldLabel);
            const input = document.createElement("input");
            field = input;
            fieldInput.appendChild(input);
            form.appendChild(fieldInput);
          }

          const value = item.getElementById("value");
          item.getElementById("query").onclick = async (event) => {
            event.preventDefault();

            let result;
            if (store.type) {
              result = await this.#context.queryStorage(pallet.name, store);
            } else if (store.map) {
              result = await this.#context.queryStorageMap(
                pallet.name,
                store,
                field.value
              );
            }

            if (!result) {
              console.warn(
                `Failed to fetch storage value ${pallet.name}::${store.name}`
              );
              return;
            }

            value.innerHTML = "";

            if (typeof result === "object") {
              value.innerText = store.name;
              const properties = valueList(result);
              value.appendChild(properties);
            } else {
              const li = document.createElement("li");
              li.innerText = result;
              value.appendChild(li);
            }
          };

          storage.appendChild(item);
        }
      } else {
        storage.remove();
      }

      const hasErrors = pallet.errors && pallet.errors.length;

      const events = template.getElementById("events");
      if (hasEvents) {
        if (hasErrors) {
          const hr = document.createElement("hr");
          hr.className = "light";
          events.after(hr);
        }

        for (const event of pallet.events) {
          const item = this.#shadowRoot
            .getElementById("event")
            .content.cloneNode(true);
          item.getElementById("name").innerText = event.name;
          const docs = item.getElementById("docs");
          for (const doc of event.docs) {
            const div = document.createElement("div");
            div.innerText = doc;
            docs.appendChild(div);
          }

          const fields = item.getElementById("fields");
          for (const field of event.fields) {
            const item = document.createElement("li");
            item.innerText = `${field.name} (${typeName(field.field, types)})`;
            fields.appendChild(item);
            if (hasFields(field.field, types)) {
              fields.appendChild(fieldTypeList(field.field, types));
            }
          }

          events.appendChild(item);
        }
      } else {
        events.remove();
      }

      const hasCalls = pallet.calls && pallet.calls.length;

      const errors = template.getElementById("errors");
      if (hasErrors) {
        if (hasCalls) {
          const hr = document.createElement("hr");
          hr.className = "light";
          errors.after(hr);
        }

        for (const error of pallet.errors) {
          const item = this.#shadowRoot
            .getElementById("error")
            .content.cloneNode(true);
          item.getElementById("name").innerText = error.name;
          const docs = item.getElementById("docs");
          for (const doc of error.docs) {
            const div = document.createElement("div");
            div.innerText = doc;
            docs.appendChild(div);
          }

          errors.appendChild(item);
        }
      } else {
        errors.remove();
      }

      const calls = template.getElementById("calls");
      if (pallet.calls && pallet.calls.length) {
        for (const call of pallet.calls) {
          const item = this.#shadowRoot
            .getElementById("call")
            .content.cloneNode(true);
          item.getElementById("name").innerText = call.name;
          const docs = item.getElementById("docs");
          for (const doc of call.docs) {
            const div = document.createElement("div");
            div.innerText = doc;
            docs.appendChild(div);
          }

          const inputs = [];
          const form = item.getElementById("call-form");
          const fields = item.getElementById("fields");
          for (const field of call.fields) {
            const item = document.createElement("li");
            item.innerText = `${field.name} (${typeName(field.field, types)})`;
            fields.appendChild(item);
            if (hasFields(field.field, types)) {
              fields.appendChild(fieldTypeList(field.field, types));
            }

            const input = inputForField(field, types);
            form.appendChild(input.input);
            inputs.push(input);
          }

          const status = item.getElementById("status");
          item.getElementById("call").onclick = async (event) => {
            event.preventDefault();
            const result = await this.#context.submitExtrinsic(
              pallet.index,
              call,
              inputs.map((i) => i.value()),
              async (data) => {
                if (data.inBlock) {
                  status.children[0]?.remove();
                  this.#context
                    .queryStorage("System", eventStore)
                    .then((events) => {
                      if (!events?.length) {
                        return;
                      }

                      const eventList = eventsList(events);
                      status.appendChild(eventList);
                    });
                  status.innerText = `🎉 In block ${data.inBlock}`;
                  return;
                }

                if (data.finalized) {
                  const events = status.children[0];
                  status.innerText = `✅ Finalized ${data.finalized}`;
                  if (events) {
                    status.appendChild(events);
                  }

                  result.unsubscribe();
                }
              }
            );

            status.children[0]?.remove();
            if (!result.error) {
              status.innerText = "🙏 Submitted";
            } else {
              status.innerText = `🛑 ${result.error.message}`;
            }
          };

          calls.appendChild(item);
        }
      } else {
        calls.remove();
      }

      this.#shadowRoot.appendChild(template);
    }
  }
}
