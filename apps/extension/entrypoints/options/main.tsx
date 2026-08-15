import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n, type Locale } from "../../src/lib/i18n";
import { createRoot } from "react-dom/client";
import {
  ApplicationRepository,
  createTemplateXlsx,
  exportBackup,
  exportCsv,
  exportXlsx,
  parseCsv,
  parseXlsx,
  restoreBackup,
  rowsToDrafts,
  getDomain,
  type Application
} from "@application-tracker/core";
import {
  computeDashboardMetrics,
  dueTodayOrThisWeek,
  staleApplications
} from "@application-tracker/analytics";
import { Button, Field } from "@application-tracker/ui";
import { ChevronDown, Download, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { downloadFile } from "../../src/lib/download";
import "./style.css";

const applicationStatuses = ["apply", "applied", "interview", "offer", "rejected"] as const;
type ExportKind = "csv" | "xlsx" | "template" | "backup";
type EditableTextField =
  "organization" | "title" | "location" | "deadline" | "sourceUrl" | "tags" | "notes";
type EditingCell = { applicationId: string; field: EditableTextField };

function Dashboard() {
  const repository = useMemo(() => new ApplicationRepository(), []);
  const { locale, setLocale, t } = useI18n();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "job" | "degree">("all");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState("");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [events, setEvents] = useState<Awaited<ReturnType<ApplicationRepository["events"]>>>([]);

  const reload = useCallback(async () => {
    const [items, events] = await Promise.all([repository.list(), repository.events()]);
    setApplications(items);
    setEvents(events);
  }, [repository]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = applications.filter((item) => {
    const haystack =
      `${item.organization} ${item.title} ${item.sourceDomain} ${item.tags.join(" ")}`.toLowerCase();
    return (
      haystack.includes(query.toLowerCase()) &&
      (type === "all" || item.type === type) &&
      (status === "all" || item.status === status)
    );
  });

  const metrics = useMemo(() => computeDashboardMetrics(filtered, events), [filtered, events]);
  const statuses = Array.from(
    new Set([...applicationStatuses, ...applications.map((item) => item.status)])
  ).sort();
  const due = dueTodayOrThisWeek(filtered);
  const stale = staleApplications(filtered);

  function statusLabel(value: string) {
    if (value === "apply") return t("apply");
    if (value === "applied") return t("applied");
    if (value === "interview") return t("interview");
    if (value === "offer") return t("offer");
    if (value === "rejected") return t("rejected");
    return value;
  }

  async function changeLocale(nextLocale: Locale) {
    await setLocale(nextLocale);
    setMessage(t("languageSaved"));
  }

  async function exportCurrent(kind: ExportKind) {
    if (kind === "csv")
      downloadFile("applications.csv", exportCsv(filtered), "text/csv;charset=utf-8");
    if (kind === "xlsx")
      downloadFile(
        "applications.xlsx",
        exportXlsx(filtered),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    if (kind === "template")
      downloadFile(
        "application-import-template.xlsx",
        createTemplateXlsx(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    if (kind === "backup")
      downloadFile("application-tracker-backup.json", await exportBackup(), "application/json");
  }

  async function download(kind: ExportKind) {
    await exportCurrent(kind);
    setDownloadMenuOpen(false);
  }

  async function importFile(file: File) {
    const rows = file.name.toLowerCase().endsWith(".csv")
      ? parseCsv(await file.text())
      : parseXlsx(await file.arrayBuffer());
    const preview = rowsToDrafts(rows);
    const valid = preview.flatMap((row) => (row.draft ? [row.draft] : []));
    for (const draft of valid) await repository.saveDraft(draft, "merge");
    setMessage(t("imported", { count: valid.length }));
    await reload();
  }

  async function importBackup(file: File) {
    await restoreBackup(await file.text());
    setMessage(t("backupRestored"));
    await reload();
  }

  async function importAny(file: File) {
    try {
      if (file.name.toLowerCase().endsWith(".json")) await importBackup(file);
      else await importFile(file);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("saveFailed"));
    }
  }

  async function updateApplicationStatus(application: Application, nextStatus: string) {
    try {
      const updated = await repository.update({ ...application, status: nextStatus });
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setMessage(t("statusUpdated"));
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("statusUpdateFailed"));
    }
  }

  async function updateApplicationType(application: Application, nextType: Application["type"]) {
    try {
      const updated = await repository.update({ ...application, type: nextType });
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setMessage(t("updatedRecords", { count: 1 }));
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("saveFailed"));
    }
  }

  function valueForField(application: Application, field: EditableTextField) {
    if (field === "tags") return application.tags.join("; ");
    if (field === "deadline") return application.deadline?.slice(0, 10) ?? "";
    return application[field] ?? "";
  }

  function beginEditing(application: Application, field: EditableTextField) {
    setEditingCell({ applicationId: application.id, field });
    setEditingValue(valueForField(application, field));
  }

  async function saveEditing(application: Application, field: EditableTextField) {
    const value = editingValue.trim();
    let next: Application;
    if (field === "tags") {
      next = {
        ...application,
        tags: value
          .split(/[;,]/)
          .map((tag) => tag.trim())
          .filter(Boolean)
      };
    } else if (field === "deadline") {
      next = { ...application, deadline: value || undefined };
    } else if (field === "location" || field === "notes") {
      next = { ...application, [field]: value || undefined };
    } else if (field === "sourceUrl") {
      next = { ...application, sourceUrl: value, sourceDomain: getDomain(value) };
    } else {
      next = { ...application, [field]: value };
    }

    setEditingCell(null);
    try {
      const updated = await repository.update(next);
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setMessage(t("updatedRecords", { count: 1 }));
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("saveFailed"));
    }
  }

  function renderEditingInput(application: Application, field: EditableTextField) {
    return (
      <input
        autoFocus
        className="inline-editor"
        type={field === "deadline" ? "date" : "text"}
        value={editingValue}
        onChange={(event) => setEditingValue(event.target.value)}
        onBlur={() => void saveEditing(application, field)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void saveEditing(application, field);
          }
          if (event.key === "Escape") {
            setEditingCell(null);
          }
        }}
      />
    );
  }

  function renderEditableText(
    application: Application,
    field: Exclude<EditableTextField, "sourceUrl">
  ) {
    const editing = editingCell?.applicationId === application.id && editingCell.field === field;
    if (editing) return renderEditingInput(application, field);
    const value = valueForField(application, field);
    return (
      <button
        className="editable-value"
        type="button"
        onClick={() => beginEditing(application, field)}
      >
        {value || "-"}
      </button>
    );
  }

  async function remove(application: Application) {
    if (deletingId) return;
    setDeletingId(application.id);
    try {
      const deleted = await repository.delete(application.id);
      if (!deleted) throw new Error(t("deleteFailed"));
      setApplications((current) => current.filter((item) => item.id !== application.id));
      setMessage(t("deleted"));
      await reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <h1>{t("dashboard")}</h1>
        </div>
        <Button onClick={() => void reload()} variant="secondary">
          <RefreshCw size={16} /> {t("refreshed")}
        </Button>
      </header>

      {message && <p className="notice">{message}</p>}

      <section className="metrics" aria-label="Dashboard metrics">
        <Metric label={t("total")} value={metrics.total} />
        <Metric label={t("thisWeek")} value={metrics.addedThisWeek} />
        <Metric label={t("active")} value={metrics.active} />
        <Metric label={t("interviewRate")} value={`${metrics.interviewRate}%`} />
        <Metric label={t("offerRate")} value={`${metrics.offerRate}%`} />
        <Metric
          label={t("avgResponse")}
          value={metrics.averageResponseDays === null ? "-" : `${metrics.averageResponseDays}d`}
        />
      </section>

      <section className="alerts">
        <strong>{t("dueThisWeek", { count: due.length })}</strong>
        <strong>{t("stale", { count: stale.length })}</strong>
      </section>

      <section className="charts">
        <div>
          <h2>{t("statusFunnel")}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.statusFunnel}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" tickFormatter={(value) => statusLabel(String(value))} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#1c5f7a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h2>{t("weeklyTrend")}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={metrics.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#7a4a1c" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="toolbar">
        <Field label={t("search")}>
          <div className="search-input">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </Field>
        <Field label={t("type")}>
          <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
            <option value="all">{t("all")}</option>
            <option value="job">{t("job")}</option>
            <option value="degree">{t("degree")}</option>
          </select>
        </Field>
        <Field label={t("applicationStatus")}>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">{t("all")}</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {statusLabel(item)}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="actions">
        <div className="download-menu">
          <Button
            variant="secondary"
            aria-expanded={downloadMenuOpen}
            onClick={() => setDownloadMenuOpen((open) => !open)}
          >
            <Download size={16} /> {t("download")} <ChevronDown size={15} />
          </Button>
          {downloadMenuOpen && (
            <div className="download-menu-panel" role="menu">
              <button type="button" onClick={() => void download("csv")}>
                {t("csv")}
              </button>
              <button type="button" onClick={() => void download("xlsx")}>
                {t("xlsx")}
              </button>
              <button type="button" onClick={() => void download("backup")}>
                {t("jsonBackup")}
              </button>
              <button type="button" onClick={() => void download("template")}>
                {t("template")}
              </button>
            </div>
          )}
        </div>
        <Button variant="secondary" onClick={() => uploadInputRef.current?.click()}>
          <Upload size={16} /> {t("upload")}
        </Button>
        <input
          ref={uploadInputRef}
          className="visually-hidden"
          type="file"
          accept=".json,.csv,.xlsx"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importAny(file);
            event.currentTarget.value = "";
          }}
        />
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("type")}</th>
              <th>{t("organization")}</th>
              <th>{t("title")}</th>
              <th>{t("location")}</th>
              <th>{t("applicationStatus")}</th>
              <th>{t("deadline")}</th>
              <th>{t("sourceUrl")}</th>
              <th>{t("tags")}</th>
              <th>{t("notes")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const editingUrl =
                editingCell?.applicationId === item.id && editingCell.field === "sourceUrl";
              return (
                <tr key={item.id}>
                  <td>
                    <select
                      className="type-select"
                      aria-label={t("type")}
                      value={item.type}
                      onChange={(event) =>
                        void updateApplicationType(item, event.target.value as Application["type"])
                      }
                    >
                      <option value="job">{t("job")}</option>
                      <option value="degree">{t("degree")}</option>
                    </select>
                  </td>
                  <td>{renderEditableText(item, "organization")}</td>
                  <td>{renderEditableText(item, "title")}</td>
                  <td>{renderEditableText(item, "location")}</td>
                  <td>
                    <select
                      className="status-select"
                      aria-label={t("applicationStatus")}
                      value={item.status}
                      onChange={(event) => void updateApplicationStatus(item, event.target.value)}
                    >
                      {statuses.map((value) => (
                        <option key={value} value={value}>
                          {statusLabel(value)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{renderEditableText(item, "deadline")}</td>
                  <td
                    className="source-url-cell"
                    onClick={() => !editingUrl && beginEditing(item, "sourceUrl")}
                  >
                    {editingUrl ? (
                      renderEditingInput(item, "sourceUrl")
                    ) : (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Link
                      </a>
                    )}
                  </td>
                  <td>{renderEditableText(item, "tags")}</td>
                  <td>{renderEditableText(item, "notes")}</td>
                  <td className="row-actions">
                    <Button
                      variant="danger"
                      disabled={deletingId === item.id}
                      onClick={() => void remove(item)}
                      aria-label="Delete record"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="empty">
                  {t("noRecords")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="settings">
        <h2>{t("settings")}</h2>
        <Field label={t("language")}>
          <select
            value={locale}
            onChange={(event) => void changeLocale(event.target.value as Locale)}
          >
            <option value="en">{t("languageEnglish")}</option>
            <option value="zh-CN">{t("languageChinese")}</option>
          </select>
        </Field>
      </section>

      <section className="settings">
        <h2>{t("privacy")}</h2>
        <p>{t("localPrivacy")}</p>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Dashboard />);
