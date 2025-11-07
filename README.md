<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/15F-6tsZb6tWHAnCNUGBXfOBJ-iV4LAyU

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Docker Deployment Notes

The provided `docker-compose.yml` file spins up PostgreSQL, the backend API, and the Nginx frontend.  
By default, the database container now uses the standard `postgres` superuser with password `postgres`. If you already have an existing data directory mounted at `DATA_ROOT`, either:

- Update the `POSTGRES_USER`/`POSTGRES_PASSWORD` environment variables (and the matching `DATABASE_*` values) so they match the credentials that were used when the data directory was first created, or
- Remove or rename the existing data directory so that the container can initialize a fresh cluster with the new credentials.

Failing to align the credentials will prevent the backend from starting and lead to `role "<user>" does not exist` errors in the PostgreSQL logs.
