"use strict";

import Account from "/lib/account.js";

export default class AccountComponent extends HTMLElement {
  static #template;
  static #alice =
    "0xe5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a";
  static {
    this.#template = document.getElementById("account").content;
  }

  #shadowRoot;
  #secret = AccountComponent.#alice;

  /**
   * @typedef { import("/lib/account.js").default } Account
   * @type { Account }
   */
  account;

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({ mode: "closed" });
    this.#shadowRoot.appendChild(AccountComponent.#template.cloneNode(true));

    if (!this.hasAttribute("secret")) {
      return;
    }

    const secret = this.getAttribute("secret");
    if (!secret.match(/0x[0-9A-Fa-f]{64}/)) {
      console.warn(
        `Invalid secret: ${secret}; reverting to development secret ${
          this.#secret
        }`
      );
      return;
    }

    this.#secret = secret;
  }

  async connectedCallback() {
    this.account = await Account.fromSecret(this.#secret);
    // this.#account = await Account.generate();
    this.#shadowRoot.getElementById("secret").innerText = this.account.secret;
    this.#shadowRoot.getElementById("public-key").innerText =
      this.account.publicKey;
  }

  /**
   * Set the SS58 for this account and the given network format
   * @param {number} ss58Format
   */
  async setAddress(ss58Format = 42) {
    this.#shadowRoot.getElementById(
      "address-title"
    ).innerText = `Address (${ss58Format})`;
    this.#shadowRoot.getElementById("address").innerText =
      this.account.address(ss58Format);
  }
}
