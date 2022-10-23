"use strict";

const components = ["account", "metadata", "app"];

for (const component of components) {
  const response = await fetch(`/dom/${component}/${component}.html`);
  const html = await response.text();
  const template = document.createElement("template");
  template.id = component;
  template.innerHTML = html;
  document.body.appendChild(template);

  const element = await import(`/dom/${component}/${component}.js`);
  customElements.define(`dots-${component}`, element.default);
}
