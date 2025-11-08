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
By default, the compose file provisions a database role named `delphi_user` with the password `strong_password_change_me`. These values are passed straight through to the backend via the `DATABASE_*` variables.

If you are reusing an existing data directory (for example, one that was initialised with the built-in `postgres` superuser), make sure to override the credentials so they match whatever role already exists in that cluster. You can do this by creating a `.env` file next to `docker-compose.yml` with entries such as:

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

Compose will automatically pick up the `.env` file and substitute the values into both the database and backend services.

Failing to align the credentials will prevent the backend from starting and lead to `role "<user>" does not exist` or `password authentication failed` errors in the PostgreSQL logs. If you no longer need the existing data, removing or renaming the mounted data directory will allow Postgres to create a fresh cluster with the configured credentials.
The provided `docker-compose.yml` file spins up PostgreSQL, the backend API, and the Nginx frontend.  
By default, the database container now uses the standard `postgres` superuser with password `postgres`. If you already have an existing data directory mounted at `DATA_ROOT`, either:

- Update the `POSTGRES_USER`/`POSTGRES_PASSWORD` environment variables (and the matching `DATABASE_*` values) so they match the credentials that were used when the data directory was first created, or
- Remove or rename the existing data directory so that the container can initialize a fresh cluster with the new credentials.

Failing to align the credentials will prevent the backend from starting and lead to `role "<user>" does not exist` errors in the PostgreSQL logs.
