# Arona Chat

Arona Chat is a refined AI chat interface inspired by the Blue Archive "Shittim Chest" UI. Built as a high-performance
monorepo, it leverages the Cloudflare serverless ecosystem to deliver a cost-efficient architecture utilizing Workers,
D1, R2, and Durable Objects.

Key Technical Highlights:

- Multi-Model Intelligence & Cost Analytics: Seamlessly integrated with OpenRouter, enabling access to a diverse
  array of cutting-edge LLMs with native, real-time token usage and USD cost tracking.
- Stateful, Resilient SSE Orchestration: By utilizing Durable Objects to decouple client connectivity from inference
  processing, Arona Chat enables robust, asynchronous background execution of SSE (Server-Sent Events) streams. This
  ensures uninterrupted processing despite network drops or client disconnects, while supporting seamless
  reconnection and guaranteeing reliable, atomic persistence of conversation history to D1 upon completion.

## Features

- Chat sessions with route-based navigation
- Password and passkey authentication
- Workspaces, attachments, and library management
- Model selection, usage tracking, and chat settings
- Cloudflare D1 for data storage and Durable Objects for session state

## Repository Layout

- `frontend/` - React UI and static assets
- `backend/` - Cloudflare Worker API, Wrangler config, and database migrations
- `shared/` - Shared TypeScript types and build outputs
- `docs/` - Project notes and copyright notices

## Repository Status

This is a public mirror of the Arona Chat project.

Development happens in a private upstream repository. This repo is periodically updated with stable versions.

## Contributions

- Issues are welcome for bug reports and feedback.
- Pull requests are not the primary workflow for this repository, as development is handled upstream.

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Prepare local backend variables:

   ```bash
   cp backend/.dev.vars.example backend/.dev.vars
   ```

   Fill in the values for your local environment or Cloudflare deployment.

3. Start the app:

   ```bash
   npm run dev
   ```

   This runs the frontend and backend dev servers together.

## Common Scripts

- `npm run dev:frontend` - start the Vite frontend on port 3000
- `npm run dev:backend` - start the Cloudflare Worker locally with Wrangler
- `npm run build` - build the shared package and frontend
- `npm run build:shared` - build the shared TypeScript package
- `npm run build:backend` - deploy the backend with Wrangler

## Configuration

- Public defaults and deployment placeholders live in `backend/wrangler.toml`.
- Local secrets should go in `backend/.dev.vars`.
- `backend/.dev.vars.example` shows the expected keys without committing secrets.

## Resource and Trademark Notice

See [docs/RESOURCE_COPYRIGHT.md](docs/RESOURCE_COPYRIGHT.md) for the Blue Archive resource notice.

This repository is a fan-made project and is not affiliated with Blue Archive, NEXON, Nexon Games, or Yostar. "Blue Archive" and "Arona" are trademarks and/or copyrights of their respective owners.

## License

This repository is licensed under the GNU Affero General Public License v3. See [LICENSE](LICENSE).
