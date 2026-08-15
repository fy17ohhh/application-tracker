import { useCallback, useEffect, useState } from "react";
import { db, type Settings } from "@application-tracker/core";

export type Locale = "en" | "zh-CN";

type MessageKey = keyof typeof messages.en;
type MessageValues = Record<string, string | number>;

const messages = {
  en: {
    appName: "ApplyBoard: Application Tracker Assistant",
    appSubtitle: "Job and degree application capture",
    dashboard: "Dashboard",
    extractPage: "Extract current page",
    downloadHtml: "Download HTML",
    extracted: "Extracted with {{confidence}}% confidence from {{source}}.",
    htmlDownloaded: "Current page HTML downloaded for extraction debugging.",
    extractionFailed: "Extraction failed.",
    saveLocal: "Save locally",
    savedLocally: "Saved locally.",
    existingUpdated: "Existing record updated.",
    saveFailed: "Save failed.",
    validationFailed: "Unable to save. Check: {{fields}}",
    validationGeneric: "Unable to save. Check the form.",
    matchingRecord: "A matching record already exists.",
    duplicateConfirm: "A matching record already exists. Replace it?",
    openDashboard: "Open dashboard",
    type: "Type",
    organization: "Organization",
    title: "Title",
    location: "Location",
    status: "Status",
    sourceUrl: "Source URL",
    deadline: "Deadline",
    nextAction: "Next Action",
    contact: "Contact",
    tags: "Tags",
    notes: "Notes",
    duplicate: "Duplicate handling",
    warnFirst: "Warn first",
    merge: "Merge",
    overwrite: "Overwrite",
    addAnyway: "Add anyway",
    job: "Job",
    degree: "Degree",
    refreshed: "Refresh",
    localSource: " ",
    total: "Total",
    thisWeek: "This week",
    active: "Active",
    interviewRate: "Interview rate",
    offerRate: "Offer rate",
    avgResponse: "Avg response",
    dueThisWeek: "Due this week: {{count}}",
    stale: "Stale follow-ups: {{count}}",
    statusFunnel: "Status funnel",
    weeklyTrend: "Weekly trend",
    search: "Search",
    all: "All",
    batchStatus: "Batch status",
    applicationStatus: "Application status",
    download: "Download",
    upload: "Upload",
    choose: "Choose",
    applied: "Applied",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
    csv: "CSV",
    xlsx: "XLSX",
    template: "Template",
    jsonBackup: "JSON backup",
    importCsvXlsx: "Import CSV/XLSX",
    restoreJson: "Restore JSON",
    previewImport: "Preview: {{valid}} valid rows, {{invalid}} invalid rows. Import valid rows?",
    imported: "Imported {{count}} rows. Duplicates were merged.",
    restoreConfirm:
      "Restore backup into local IndexedDB? Existing matching IDs will be overwritten.",
    backupRestored: "Backup restored.",
    updatedRecords: "Updated {{count}} records.",
    statusUpdated: "Application status updated.",
    statusUpdateFailed: "Unable to update the application status.",
    deleteConfirm: "Delete {{title}}? This only removes local data.",
    select: "Select",
    actions: "Actions",
    domain: "Domain",
    noRecords:
      "No records yet. Open a job or program page and click the extension icon to extract it.",
    privacy: "Privacy",
    localPrivacy:
      "The extension reads the active tab only after your click. Local data stays in IndexedDB.",
    language: "Language",
    languageEnglish: "English",
    languageChinese: "简体中文",
    languageSaved: "Language updated.",
    deleted: "Record deleted.",
    deleteFailed: "Unable to delete the record.",
    settings: "Settings"
  },
  "zh-CN": {
    appName: "申请追踪助手",
    appSubtitle: "职位与学位申请记录",
    dashboard: "控制面板",
    extractPage: "提取当前页面",
    downloadHtml: "下载 HTML",
    extracted: "已从 {{source}} 提取，置信度 {{confidence}}%。",
    htmlDownloaded: "当前页面 HTML 已下载，可用于调试提取规则。",
    extractionFailed: "提取失败。",
    saveLocal: "保存到本地",
    savedLocally: "已保存到本地。",
    existingUpdated: "已有记录已更新。",
    saveFailed: "保存失败。",
    validationFailed: "无法保存，请检查：{{fields}}",
    validationGeneric: "无法保存，请检查表单内容。",
    matchingRecord: "已存在匹配记录。",
    duplicateConfirm: "已存在匹配记录。是否覆盖这条记录？",
    openDashboard: "打开控制面板",
    type: "类型",
    organization: "组织",
    title: "标题",
    location: "地点",
    status: "状态",
    sourceUrl: "来源 URL",
    deadline: "截止日期",
    nextAction: "下一步",
    contact: "联系人",
    tags: "标签",
    notes: "备注",
    duplicate: "重复处理",
    warnFirst: "先提示",
    merge: "合并",
    overwrite: "覆盖",
    addAnyway: "仍然新增",
    job: "职位",
    degree: "学位",
    refreshed: "刷新",
    localSource: "本地 IndexedDB 是唯一数据源，共记录 {{count}} 个事件。",
    total: "总数",
    thisWeek: "本周新增",
    active: "进行中",
    interviewRate: "面试率",
    offerRate: "Offer 率",
    avgResponse: "平均响应",
    dueThisWeek: "本周待办：{{count}}",
    stale: "长期未跟进：{{count}}",
    statusFunnel: "状态漏斗",
    weeklyTrend: "每周趋势",
    search: "搜索",
    all: "全部",
    batchStatus: "批量状态",
    applicationStatus: "申请状态",
    download: "下载",
    upload: "上传",
    choose: "请选择",
    applied: "已申请",
    interview: "面试",
    offer: "Offer",
    rejected: "已拒绝",
    csv: "CSV",
    xlsx: "XLSX",
    template: "模板",
    jsonBackup: "JSON 备份",
    importCsvXlsx: "导入 CSV/XLSX",
    restoreJson: "恢复 JSON",
    previewImport: "预览：{{valid}} 行有效，{{invalid}} 行无效。导入有效行？",
    imported: "已导入 {{count}} 行，重复记录已合并。",
    restoreConfirm: "恢复备份到本地 IndexedDB？相同 ID 的记录将被覆盖。",
    backupRestored: "备份已恢复。",
    updatedRecords: "已更新 {{count}} 条记录。",
    statusUpdated: "申请状态已更新。",
    statusUpdateFailed: "无法更新申请状态。",
    deleteConfirm: "删除 {{title}}？这只会删除本地数据。",
    select: "选择",
    actions: "操作",
    domain: "域名",
    noRecords: "暂无记录。打开职位或项目页面后点击扩展图标进行提取。",
    privacy: "隐私",
    localPrivacy: "扩展只会在你点击后读取当前页面，本地数据保存在 IndexedDB。",
    language: "语言",
    languageEnglish: "English",
    languageChinese: "简体中文",
    languageSaved: "语言已更新。",
    deleted: "记录已删除。",
    deleteFailed: "无法删除记录。",
    settings: "设置"
  }
} satisfies Record<Locale, Record<string, string>>;

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    let active = true;
    void db.settings.get("default").then((settings) => {
      if (active && settings?.locale) setLocaleState(settings.locale);
    });
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback(async (nextLocale: Locale) => {
    const previous = await db.settings.get("default");
    const next: Settings = {
      id: "default",
      locale: nextLocale,
      privacy: previous?.privacy ?? { allowDiagnostics: false }
    };
    await db.settings.put(next);
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (key: MessageKey, values: MessageValues = {}) => {
      const template = messages[locale][key] ?? messages.en[key] ?? key;
      return template.replace(/{{(\w+)}}/g, (_, name: string) => String(values[name] ?? ""));
    },
    [locale]
  );

  return { locale, setLocale, t };
}
