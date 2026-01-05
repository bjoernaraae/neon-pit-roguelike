# Neon Pit Roguelike

## 🎮 Quick Start for Beginners

**👉 New to this? Start here:** Read [SETUP_GUIDE.md](SETUP_GUIDE.md) for step-by-step instructions!

### Quick Start (If you already have Node.js installed)

1. **Install dependencies** (first time only):
   ```bash
   npm install
   ```

2. **Start the development server:**
   
   **Windows (PowerShell):**
   ```powershell
   .\start-dev.ps1
   ```
   
   **Windows (Command Prompt):**
   ```cmd
   start-dev.bat
   ```
   
   **Or directly:**
   ```bash
   npm run dev
   ```

3. The game will open automatically at `http://localhost:3000` with live preview enabled.
   
4. **To view in Cursor's browser:**
   - Press `Ctrl+Shift+P`
   - Type "Simple Browser: Show"
   - Enter: `http://localhost:3000`

### Alternative: Static Server (Legacy)

If you don't have Node.js/npm installed, you can use a simple static server:

1. **Start a local server:**

   **Option A - Python:**
   ```bash
   python -m http.server 8000
   ```
   Or double-click `start-server.bat` (Windows)

   **Option B - PowerShell:**
   ```powershell
   .\start-server.ps1
   ```

2. **Open your browser** and go to:
   ```
   http://localhost:8000
   ```

   **Note:** The static server requires the project to be built first (`npm run build`).

## Testing

Run unit tests:
```bash
npm test
```

## Project Structure

```
src/
├── utils/           # Utility functions (math, color, data)
├── data/            # Game constants and data
├── game/
│   ├── systems/     # Game systems (collision, pathfinding)
│   └── world/       # World generation (BSP, level generation)
├── rendering/       # Rendering systems (isometric)
└── components/      # React components
```
