import browser from "webextension-polyfill";
import { defineBackground } from "wxt/sandbox";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void browser.storage.local.set({ installedAt: new Date().toISOString() });
  });
});
