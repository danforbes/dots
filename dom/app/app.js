"use strict";

import Context from "/lib/context.js";

export default class AppComponent extends HTMLElement {
  static #template;
  static {
    this.#template = document.getElementById("app").content;
  }

  #shadowRoot;

  /**
   * @typedef { import("/lib/context.js").default } Context
   * @type { Context }
   */
  #context;

  /**
   * @typedef { import("/dom/account/account.js").default } AccountComponent
   * @type { AccountComponent }
   */
  #account;

  /**
   * @typedef { import("/dom/metadata/metadata.js").default } MetadataComponent
   * @type { MetadataComponent }
   */
  #metadata;

  constructor() {
    super();
    this.#shadowRoot = this.attachShadow({ mode: "closed" });
    this.#shadowRoot.appendChild(AppComponent.#template.cloneNode(true));
    this.#account = this.#shadowRoot.getElementById("account");
    this.#metadata = this.#shadowRoot.getElementById("metadata");
  }

  async connectedCallback() {
    this.#context = await Context.new("ws://127.0.0.0:9944");
    this.#context.account = this.#account.account;
    this.#metadata.setContext(this.#context);
    this.#account.setAddress(this.#context.system.properties.ss58Format);
  }
}
