import React, { useMemo, useState } from "react";
import { useI18n } from "../../src/lib/i18n";
import { createRoot } from "react-dom/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import browser from "webextension-polyfill";
import { AlertCircle, Database, Download, ExternalLink, Loader2, Save, Search } from "lucide-react";
import {
  ApplicationRepository,
  applicationDraftSchema,
  type ApplicationDraft
} from "@application-tracker/core";
import { extractApplication } from "@application-tracker/extractors";
import { Button, Field } from "@application-tracker/ui";
import { downloadFile } from "../../src/lib/download";
import { getCurrentPageContext } from "../../src/lib/pageContext";
import "./style.css";

const optionalDateInput = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().datetime().or(z.string().date()).optional()
);

const formSchema = applicationDraftSchema.extend({
  deadline: optionalDateInput,
  appliedAt: optionalDateInput,
  nextActionAt: optionalDateInput,
  tagsText: z.string().optional()
});
type FormValues = z.infer<typeof formSchema>;

function Popup() {
  const repository = useMemo(() => new ApplicationRepository(), []);
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "extracting" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "job",
      organization: "",
      title: "",
      status: "applied",
      sourceUrl: "",
      sourceDomain: "",
      tags: [],
      tagsText: "",
      customFields: {},
      extractionSource: "manual"
    }
  });

  async function extractCurrentPage() {
    setState("extracting");
    setMessage("");
    try {
      const context = await getCurrentPageContext();
      const result = await extractApplication(context);
      form.reset({
        ...form.getValues(),
        ...result.data,
        status: "applied",
        tagsText: result.data.tags?.join("; ") ?? "",
        customFields: result.data.customFields ?? {}
      });
      setWarnings(result.warnings);
      setMessage(
        t("extracted", { confidence: Math.round(result.confidence * 100), source: result.source })
      );
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : t("extractionFailed"));
    }
  }

  async function downloadCurrentHtml() {
    setMessage("");
    try {
      const context = await getCurrentPageContext();
      const filename = `${context.domain.replace(/[^a-z0-9.-]/gi, "_")}-${Date.now()}.html`;
      downloadFile(filename, context.html, "text/html;charset=utf-8");
      setMessage(t("htmlDownloaded"));
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : t("saveFailed"));
    }
  }

  async function save(values: FormValues) {
    setState("saving");
    setMessage("");
    try {
      const {
        tagsText,
        status: _status,
        contact: _contact,
        nextActionAt: _nextActionAt,
        ...draftValues
      } = values;
      void _status;
      void _contact;
      void _nextActionAt;
      const draft: ApplicationDraft = {
        ...draftValues,
        status: "applied",
        tags: (tagsText ?? "")
          .split(/[;,]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        customFields: values.customFields ?? {}
      };
      const initialResult = await repository.saveDraft(draft, "warn");
      if (initialResult.action === "duplicate-warning") {
        if (!window.confirm(t("duplicateConfirm"))) {
          setState("idle");
          return;
        }
        await repository.saveDraft(draft, "overwrite");
        setState("saved");
        setMessage(t("existingUpdated"));
        return;
      }
      setState("saved");
      setMessage(t("savedLocally"));
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : t("saveFailed"));
    }
  }

  function showValidationErrors(errors: typeof form.formState.errors) {
    const fields = Object.keys(errors);
    setState("error");
    setMessage(
      fields.length > 0
        ? t("validationFailed", { fields: fields.join(", ") })
        : t("validationGeneric")
    );
  }

  return (
    <main className="popup-shell">
      <header>
        <div>
          <h1>{t("appName")}</h1>
          <p>{t("appSubtitle")}</p>
        </div>
        <Button
          variant="secondary"
          aria-label={t("openDashboard")}
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          <Database size={16} />
        </Button>
      </header>

      <div className="button-row">
        <Button onClick={() => void extractCurrentPage()} disabled={state === "extracting"}>
          {state === "extracting" ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
          {t("extractPage")}
        </Button>
        <Button variant="secondary" onClick={() => void downloadCurrentHtml()}>
          <Download size={16} />
          {t("downloadHtml")}
        </Button>
      </div>

      {message && <p className={`notice ${state === "error" ? "error" : ""}`}>{message}</p>}
      {warnings.length > 0 && (
        <div className="warning" role="alert">
          <AlertCircle size={16} />
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={(event) => void form.handleSubmit(save, showValidationErrors)(event)}
        className="form-grid"
      >
        <Field label={t("type")}>
          <select {...form.register("type")}>
            <option value="job">{t("job")}</option>
            <option value="degree">{t("degree")}</option>
          </select>
        </Field>
        <Field label={t("organization")}>
          <input {...form.register("organization")} />
        </Field>
        <Field label={t("title")}>
          <input {...form.register("title")} />
        </Field>
        <Field label={t("location")}>
          <input {...form.register("location")} />
        </Field>
        <Field label={t("sourceUrl")}>
          <input {...form.register("sourceUrl")} />
        </Field>
        <Field label={t("deadline")}>
          <input {...form.register("deadline")} placeholder="YYYY-MM-DD or ISO" />
        </Field>
        <Field label={t("tags")}>
          <input {...form.register("tagsText")} placeholder="frontend; remote" />
        </Field>
        <Field label={t("notes")}>
          <textarea {...form.register("notes")} rows={3} />
        </Field>
        <Button type="submit" disabled={state === "saving"}>
          {state === "saving" ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
          {t("saveLocal")}
        </Button>
      </form>

      <button
        className="link-button"
        type="button"
        onClick={() => void browser.runtime.openOptionsPage()}
      >
        <ExternalLink size={14} /> {t("openDashboard")}
      </button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Popup />);
