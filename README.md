# MUMOFX Academy

A multi-page trading academy website with a real backend authentication system and an admin dashboard.

## Features

- Secure sign up and sign in flow with password hashing
- Session-based auth and protected dashboard routes
- Admin dashboard with user summary and member management data
- Multi-page marketing site for academy, bots, market, and legal pages
- Render-ready deployment configuration

## Local development

```bash
npm install
cp .env.example .env
npm start
```

Then open:

- http://localhost:3000/
- http://localhost:3000/signup.html
- http://localhost:3000/signin.html
- http://localhost:3000/dashboard.html
- http://localhost:3000/admin.html

## Production deployment

This repo includes a Render configuration in `render.yaml` for one-click deployment from GitHub.

1. Push this repository to GitHub.
2. Connect the repo in Render.
3. Render will build and deploy the app automatically.

## Default admin account

- Email: admin@mumofx.com
- Password: MumofxAdmin@2026!

Change this immediately in production via the `ADMIN_PASSWORD` environment variable.
