# Task Manager

A simple task list built with HTML, CSS, and JavaScript. Create, edit, complete, and delete tasks.

## Run locally

Open PowerShell in the project folder and run:

```powershell
py -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Stop the server with `Ctrl+C`.

While `supabaseUrl` and `supabasePublishableKey` in `config.json` are empty, the app works locally and stores tasks in the browser's `localStorage`. A local web server is required to load `config.json`; opening `index.html` directly with `file://` is not supported.

## Connect Supabase

The app sends requests directly to the Supabase REST API. No separate backend is needed. It will not connect until you fill in the two fields in `config.json`:

```json
{
  "supabaseUrl": "https://YOUR_PROJECT_ID.supabase.co",
  "supabasePublishableKey": "YOUR_PUBLIC_PUBLISHABLE_KEY",
  "tableName": "tasks",
  "studentId": "YOUR_VISTULA_STUDENT_ID"
}
```

## GitHub Pages

1. Create a public `vistula-task-manager` repository using your course GitHub account, named `vistula-team-project-STUDENT_ID`.
2. Replace `STUDENT_ID` with your student ID in `config.json`; it will also appear on the page.
3. Upload the project files to the root of the `main` branch.
4. In the repository settings, open **Pages** and publish from the `main` branch and `/(root)` folder.
5. After publishing, the site will be available at `https://USERNAME.github.io/vistula-task-manager/`.

Add your public Supabase URL and key before checking the remote database. `config.json` is published with the site, so it must contain only a public key.

## Partner contribution

The “Contributor page” link points to `contribution.html`. Per the assignment, another student must add `contribution.html` and `contribution.json` through a Pull Request; get those files from their PR.

## Project files

- `index.html` — the application page.
- `style.css` — simple styles without animations.
- `app.js` — local storage and REST API operations.
- `config.json` — REST API settings and student ID.
