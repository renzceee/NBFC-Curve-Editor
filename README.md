# NBFCCurveEditor

A small helper tool for editing NoteBook Fan Control (NBFC) / [NBFC-Linux](https://github.com/nbfc-linux/nbfc-linux) fan-curve profiles. It consists of:

- A browser-based editor (`index.html`, `app.js`, `styles.css`) that lets you import, tweak, and export NBFC JSON configs.
- A lightweight Express helper server (`server.js`) that accepts a JSON profile and applies it via the bundled `apply_nbfc_curve.sh` script.

> **Warning:** Applying a curve writes files into `/usr/share/nbfc/configs` and restarts `nbfc`. You must trust the profile you upload and understand the risk of misconfigured fan tables.

## Prerequisites

1. **Node.js 18+** (older versions with native `fetch` support for the client are fine, but the helper server expects modern syntax).
2. **npm** (bundled with Node) for installing dependencies.
3. **NBFC-Linux** (NoteBook FanControl port for Linux) installed and working on your machine. The helper script calls `nbfc` via `sudo`.
4. `bash`, `mktemp`, and standard GNU userland utilities (already present on most Linux distributions).

## Installation

```bash
# Inside the repo root
npm install
```

This installs the Express server along with development helpers (`nodemon`, `live-server`, `concurrently`).

## Running the app

### 1. Start the Express helper server only

```bash
sudo npm run server
```

- Runs `nodemon`, which watches `server.js` and `apply_nbfc_curve.sh`.
- Exposes `POST /apply` on `http://localhost:3000` and forwards payloads to the shell script.
- `sudo` ensures the helper can restart NBFC and copy configs without repeatedly prompting for your password.

### 2. Start the static client only

```bash
npm run client
```

- Serves `index.html` at `http://127.0.0.1:5500` via `live-server`.
- No framework build step—edits to HTML/JS/CSS hot-reload automatically.

### 3. Run both client and server together (recommended during development)

```bash
sudo npm run dev
```

- Uses `concurrently` to run `npm run server` (as root) and `npm run client` in parallel.
- Visit `http://127.0.0.1:5500` and load an NBFC JSON to begin editing.
- If you prefer to avoid running the client with elevated privileges, start two terminals: run `sudo npm run server` in one and `npm run client` in the other.

## Applying a curve manually

The helper UI calls the Express endpoint, which in turn executes `apply_nbfc_curve.sh`. You can also run the script directly:

```bash
./apply_nbfc_curve.sh path/to/fan-profile.json
```

What it does:

1. Validates the JSON exists.
2. Copies it into a temp file to avoid partial writes.
3. Stops the NBFC service (`sudo nbfc stop`).
4. Moves the file into `/usr/share/nbfc/configs/<profile>.json` and sets permissions.
5. Applies the profile with `sudo nbfc config -a <profile>`.

Because of the privileged operations, the script prompts for your sudo password.

## Project structure

```
├── app.js                # Front-end logic for parsing/rendering NBFC profiles
├── index.html            # UI skeleton
├── styles.css            # Styling (responsive layout, dark/light combos)
├── server.js             # Express helper server exposing POST /apply
├── apply_nbfc_curve.sh   # Bash script that installs & applies NBFC configs
├── nodemon.json          # Nodemon configuration used by `npm run server`
├── package.json          # Scripts and dependency manifest
└── package-lock.json
```

## Troubleshooting

1. **`EACCES` or permission errors when applying**: ensure you run the helper server in an environment where `sudo` can be prompted (a terminal, not a background daemon). The service must have access to `/usr/share/nbfc/configs`.
2. **`POST /apply` fails with `Helper script not found`**: confirm `apply_nbfc_curve.sh` is executable (`chmod +x apply_nbfc_curve.sh`).
3. **Live-server opens a browser automatically**: add `--no-browser` to the `client` script (already set) or use a different port via `PORT=XXXX npm run client`.
4. **NBFC binary missing**: install NBFC from <https://github.com/hirschmann/nbfc> and verify `nbfc status` works before using the editor.

## Contributing / extending

- The front-end uses vanilla JS and custom UI helpers stored in `app.js`. Consider splitting into modules if it grows larger.
- To support another laptop model, load that model's NBFC/nbfc-linux JSON profile and tweak the UI copy (e.g., page title) accordingly.
- Pull requests should include clear instructions for reproducing changes and any additional prerequisites.
