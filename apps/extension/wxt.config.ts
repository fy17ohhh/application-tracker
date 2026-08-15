import { defineConfig } from "wxt";

export default defineConfig({
  outDir: "output",
  manifestVersion: 3,
  manifest: {
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    permissions: ["activeTab", "scripting", "storage"],
    icons: {
      "16": "icons/16.png",
      "32": "icons/32.png",
      "48": "icons/48.png",
      "64": "icons/64.png",
      "128": "icons/128.png"
    },
    action: {
      default_popup: "popup.html",
      default_icon: {
        "16": "icons/16.png",
        "32": "icons/32.png",
        "48": "icons/48.png",
        "64": "icons/64.png",
        "128": "icons/128.png"
      }
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true
    },
    background: {
      service_worker: "background.js",
      type: "module"
    }
  }
});
