# ApplyBoard

A lightweight browser extension for tracking job and degree applications from the pages you visit.

<p align="center">
  <img src="img/dashboard.png" alt="Dashboard" width="66%" />
</p>

[English](README.md) | [简体中文](README.zh-CN.md)

## Overview

ApplyBoard helps you organize the application process without leaving the browser. It can extract key details from a job posting or academic page, review and edit the result, and save it locally for follow-up.

Built with Manifest V3 (MV3) and a TypeScript monorepo, the project keeps data local in the browser and supports CSV, XLSX, and JSON exports for backups and analysis.

## Features

- Track status, deadlines, notes, tags, and custom metadata; edit entries in-line within bashboard
- Store records locally in IndexedDB, enable fast update and one-click delete
- Import and export backup files in CSV, XLSX, and JSON formats
- Support Chrome and Edge extension builds

## Quick start

### 🚀 Install directly

Visit [Chrome Web Store](https://chromewebstore.google.com/detail/fdjhphelkmbgieokmgpflcicgbloffph?utm_source=item-share-cb) and select `Add to Chrome`

---

### 🔧 Local Development

**Prerequisites**

- Node.js 18+
- pnpm 9+

**Install dependencies**

```bash
corepack pnpm install
```

**Build the extension**

```bash
corepack pnpm build # default to chrome
corepack pnpm --filter @application-tracker/extension build:edge # microsoft edge
```

This command generates the extension bundle for the configured browser target.

**Load the Extension in Your Browser**

1. Open your browser’s extensions page.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the folder:
   `apps/extension/output/<browser>-mv3`

5. Load the entire folder.

For local development setup, testing, and contribution workflow, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Example Usage

<p align="center">
  <img src="img/usage.png" alt="usage-example" width="400" />
  <img src="img/entries.png" alt="entries" width="400" />
</p>

## Privacy

ApplyBoard stores application records locally in the browser's IndexedDB. The extension reads the active page only after an explicit user action. It does not send application data to a remote service by default, and exports are designed for user-controlled backups.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.

## License

This project is licensed under the [MIT License](LICENSE).
