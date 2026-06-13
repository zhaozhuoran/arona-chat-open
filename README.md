# Arona Chat

Arona Chat is a fan-made, Blue Archive themed chat application built with React, TypeScript, Vite, Cloudflare Workers, D1, and R2.

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

This repository is a public synchronized build of Arona Chat.

- The upstream repository is private and is the source of active development.
- This repository is updated periodically to reflect stable upstream versions.
- Development does not happen here.

## Issues and Pull Requests

- Issues are welcome for bug reports, feedback, or usage questions.
- Pull requests are generally not accepted, as this repository is not used for active development.
- Feature contributions should not be submitted here.

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
