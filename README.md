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

## 🎮 Controls

### Movement
- **WASD** or **Arrow Keys** - Move your character
- **Space** - Jump (character-specific ability)
- **Shift** - Activate special ability (character-specific)

### Menu & Navigation
- **E** or **Enter** - Interact with objects, select options, start game
- **A/D** or **Left/Right Arrows** - Navigate through upgrade choices
- **1, 2, 3** - Quick select upgrade options
- **Tab** - Toggle stats display
- **Escape** - Pause menu / Close menus

### Audio & Display
- **M** - Toggle mute/unmute
- **[** - Decrease volume
- **]** - Increase volume
- **F** - Toggle fullscreen

## 💡 Tips & Tricks

### Combat
- **Keep moving!** Standing still makes you an easy target
- **Use your environment** - Corridors and rooms offer different tactical advantages
- **Watch for visual cues** - Danger zones appear before attacks
- **Positioning matters** - Some areas are safer than others during combat

### Upgrades & Progression
- **Choose wisely** - Each upgrade choice shapes your build
- **Balance is key** - Consider both offense and defense
- **Experiment** - Different combinations create unique playstyles
- **Plan ahead** - Some upgrades synergize better than others

### Resource Management
- **Prioritize** - Not all resources are equally valuable
- **Timing** - Sometimes it's better to save than spend immediately
- **Explore** - Hidden opportunities await in every level

### Survival
- **Learn patterns** - Enemies and bosses have predictable behaviors
- **Stay aware** - Keep an eye on your surroundings
- **Don't panic** - Take a moment to assess the situation
- **Practice makes perfect** - Each run teaches you something new

### General
- **Try different characters** - Each has unique abilities and playstyles
- **Read the visuals** - The game communicates important information through colors and effects
- **Take breaks** - Sometimes stepping away helps you see new strategies
- **Have fun!** - Experiment and find what works for you

## 📁 Project Structure

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
