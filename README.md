English | [简体中文](README-cn.md)

# 🌸 Arona Chat

![License](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)
![Status](https://img.shields.io/badge/Status-Public--Mirror-orange.svg)
[![Demo](https://img.shields.io/badge/Demo-Live%20Preview-green.svg)](https://arona-chat-open.pages.dev/login?password=preview&autologin=1)

Arona Chat is a high-performance AI chat interface inspired by the _Blue Archive_ "Shittim Chest" UI. Built as a monorepo, it leverages the Cloudflare serverless ecosystem (Workers, D1, R2, Durable Objects) to deliver a cost-efficient, stateful chat experience.

## 🧠 System Architecture

```mermaid
graph TD
    Client[Browser/Client] <-->|API Requests & SSE Streams| Worker[Cloudflare Worker]

    Worker <-->|Auth/Config/Library| D1[(Cloudflare D1)]
    Worker <-->|Attachment Storage/Proxy| R2[(Cloudflare R2)]
    Worker <-->|Management/Orchestration| DO[Durable Objects]

    DO <-->|SSE Event Stream/Persistence| Client
    DO <-->|Session Metadata/History| D1
    DO <-->|Call AI Inference| API[OpenRouter API]
```

## 🧠 Highlights

- 💰 **Real-time cost tracking** (tokens + USD usage)
- 🧠 **Multi-model orchestration** via OpenRouter
- 📡 **Stateful SSE streaming** with Durable Objects
- 🧷 **Resilient connection layer** (auto recovery on disconnect)

## 🖼️ Screenshots

![Arona Chat Interface](assests/screenshots/screenshot-1.png)

![Arona Chat Cost Tracking](assests/screenshots/screenshot-2.png)

![Arona Chat Attachment Management](assests/screenshots/screenshot-3.png)

## 🚀 Quick Start

```bash
npm install
```

```bash
cp backend/.dev.vars.example backend/.dev.vars
```

```bash
npm run dev
```

## 🌟 Project Origin

This project was developed as part of Hack Club Stardance.

View the original project page: [https://stardance.hackclub.com/projects/17862](https://stardance.hackclub.com/projects/17862)

## 📁 Repository Status

This is a **public mirror** of the Arona Chat project.
Development occurs in a private upstream repository; this mirror is updated periodically with stable versions.

## 🤝 Contributions

Issues are welcome for bug reports and feedback.
Pull requests are not the primary workflow for this repository.

## License

Licensed under **GNU Affero General Public License v3**.
See [LICENSE](LICENSE).

## Resource Notice

See [docs/RESOURCE_COPYRIGHT.md](docs/RESOURCE_COPYRIGHT.md)

This is a fan-made project and is not affiliated with Blue Archive, NEXON, Nexon Games, or Yostar.
