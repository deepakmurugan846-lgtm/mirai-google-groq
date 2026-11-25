# MIRAI Google Forms + Groq starter

## Included
- React tablet robot interface and QR generation
- Your supplied Google Form and Registration Code field ID `1612857634`
- Socket.IO registration completion announcement
- Google Apps Script webhook (`apps-script/Code.gs`)
- Groq chat endpoint (API key stays on server)
- Basic live admin view at `/admin`

## 1. Configure secrets
From the project root:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```
Edit `server/.env`:
- `GROQ_API_KEY`: your Groq key from https://console.groq.com/keys
- `GOOGLE_WEBHOOK_SECRET`: create a long random secret, for example `openssl rand -hex 32`
- `ADMIN_KEY`: add a private dashboard password, e.g. `ADMIN_KEY=choose_a_long_password`
- `CLIENT_ORIGIN=http://localhost:5173`

The `.env.example` currently lists the main server settings; add `ADMIN_KEY=...` to `server/.env`.

## 2. Install and run locally
```bash
npm run install:all
```
Terminal 1:
```bash
npm run dev:server
```
Terminal 2:
```bash
npm run dev:client
```
Open http://localhost:5173. Open http://localhost:5173/admin for the dashboard.

## 3. Google Sheets + Apps Script
1. In the Google Form, open Responses and link a new Google Sheet.
2. In the Sheet choose Extensions > Apps Script.
3. Replace the editor contents with `apps-script/Code.gs`.
4. Set `WEBHOOK_URL` to your deployed backend URL plus `/api/google-form-webhook`.
5. Set `WEBHOOK_SECRET` to exactly the same value as `GOOGLE_WEBHOOK_SECRET` in Render.
6. Save. Open Triggers (clock icon) > Add Trigger:
   - function: `onFormSubmit`
   - event source: From spreadsheet
   - event type: On form submit
7. Authorize the script.

The form question titles must match the labels in `Code.gs`, especially `Registration Code` and `Which do you like the most?`.

## 4. Render deployment
Create a Render Web Service from this repository.
- Build command: `npm run install:all && npm run build`
- Start command: `npm start`
- Add environment variables: `GROQ_API_KEY`, `GROQ_MODEL=llama-3.3-70b-versatile`, `GOOGLE_WEBHOOK_SECRET`, `ADMIN_KEY`, `CLIENT_ORIGIN` (set to your deployed service URL).
- After deployment, update `WEBHOOK_URL` in Apps Script to `https://YOUR-SERVICE.onrender.com/api/google-form-webhook`.

The tablet app uses the same Render origin in production. The QR is generated locally and shown without waiting for the server. Registration completion still requires internet connectivity and a working deployed backend.

## Important reliability and privacy notes
- Google Sheets is the persistent source of truth for form responses.
- This starter's `/api/admin/registrations` list is in-memory and resets when the server restarts; use Google Sheets for the permanent visitor register.
- The server receives visitor details from Apps Script and emits a live dashboard event, but does not persist personal data. Phone/email are not displayed in the admin screen.
- Only use real visitor information after reviewing your Google Form sharing settings and restricting access to the response spreadsheet.
- Groq API keys and webhook secrets must never be placed in frontend `.env` variables or committed to Git.
- A visitor must submit the Google Form online. If the tablet/server is offline at the moment of submission, the live robot announcement cannot be guaranteed. Google Sheets still records the response.
- Browser speech synthesis voice availability varies by tablet/browser; select an English voice in the device settings if needed.
