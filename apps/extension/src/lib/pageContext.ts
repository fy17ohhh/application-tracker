import browser from "webextension-polyfill";
import type { PageContext } from "@application-tracker/extractors";
import { getDomain } from "@application-tracker/core";

type ScriptPageContext = Omit<PageContext, "domain">;

export async function getCurrentPageContext(): Promise<PageContext> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("No active page is available.");
  const [result] = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      url: location.href,
      title: document.title,
      html: document.documentElement.outerHTML,
      text: document.body.innerText
    })
  });
  const value = result?.result as ScriptPageContext | undefined;
  if (!value) throw new Error("Could not read the current page.");
  return {
    ...value,
    domain: getDomain(value.url)
  };
}
