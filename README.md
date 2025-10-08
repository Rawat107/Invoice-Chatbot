# Invoice Chatbot

AI-assisted invoice parser and Q\&A app. Backend exposes REST APIs for uploading invoices (PDF/Images) and analytics; frontend is a static HTML/JS UI styled via Tailwind CLI. Designed with a simple MVC structure and ready for separate deployment of API and static site.

## Live Link
https://invoice-chatbot-mocha.vercel.app/

## Features

- File uploads (PDF, PNG, JPG, WEBP) via Multer; basic PDF text extraction with pdf-parse and filename fallbacks.
- Vendor/number/total/date extraction and rule-based Q\&A; optional Groq API for LLM responses.
- Clean MVC: controllers/, models/, routes/, services/, utils/ in backend; static index.html + Tailwind-built CSS in frontend.
- Cloud-friendly: API-only backend (no server-side HTML), static hosting for frontend.

## Repo layout

- backend/
  - server.js, routes/, controllers/, models/, services/, utils/, uploads/
  - package.json (Express app)
- frontend/
  - index.html, src/js/app.js, src/input.css → src/output.css (Tailwind)
  - package.json (Tailwind CLI scripts)

## Prerequisites

- Node 18+ and npm.
- A Groq API key (optional, for AI responses). Set GROQ_API_KEY in backend env.

## Backend (API) – Run locally

1. Install and configure:

- cd backend
- npm install
- Create .env:
  - GROQ_API_KEY=your_key
  - PORT=3000

2. Start:

- npm start
- API lives at http://localhost:3000/api, health can be added at /health if desired.

Scripts (from package.json):

- npm run dev → nodemon server.js
- npm start → node server.js

## Frontend (static) – Run locally

1. Install:

- cd frontend
- npm install

2. Build Tailwind CSS once:

- npm run dev

3. Open UI:

- Open frontend/index.html in a browser, or serve statically with any static server.

4. Configure API base URL:

- In app.js, use an .env file to get the API_BASE_URL and have a fallback if that is not working using OR. So make sure to add the env variable during deployement.

Tailwind CLI notes:

- Local dev (watch): npm run dev
- Production build (minified): npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css --min (use this in CI/CD)

## Deployment (summary)

- Backend → Render Web Service

  - Root Directory: backend
  - Build Command: npm install
  - Start Command: npm start
  - Env: GROQ_API_KEY, NODE_ENV=production

- Frontend → Render Static Site
  - Root Directory: frontend
  - Build Command: npm i \&\& npm run build
  - Publish Directory: frontend (folder containing index.html), or “.” if index.html at root
  - Env: API_BASE_URL=https://your-api.onrender.com/api

## Common issues

- 404 ENOENT for /views/index.html on backend after split: remove the HTML route; backend should not serve the frontend.
- CORS errors: keep app.use(cors()) in backend; optionally restrict origin to the static site domain.

## Useful commands

- Clean uploads dir manually if needed; it’s created on boot if missing.
- Tailwind dev: npm run dev (watch) / build: npm run build (one-time). Don’t use --watch in CI.

## License

ISC


