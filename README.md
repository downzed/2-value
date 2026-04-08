# 2-value

A 2-value image editor for drawing studies. Converts images to a 2-tone palette using blur and threshold adjustments.

## Commands

- `yarn dev` - Run in development mode (electron-vite, port 5173)
- `yarn build` - Build for production
- `yarn start` - Run built app in production mode
- `yarn typecheck` - Run TypeScript type checking
- `yarn package` - Package the app
- `yarn make` - Create distributable

## Features

- Open images (PNG, JPG, JPEG, BMP)
- Save images as PNG
- Adjustable blur (0-10)
- Adjustable threshold (0-255)
- Invert toggle
- Drag-and-drop panel positioning (persisted)
- View original vs filtered side-by-side
- Real-time filter preview

## Architecture

- `src/main/` - Electron main process (Node.js)
- `src/preload/` - IPC bridge (exposes `electronAPI.openImage`, `electronAPI.saveImage`)
- `src/renderer/` - React frontend with Canvas, BottomPanel, FloatingControls, FloatingImage

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Electron 41.2.0 |
| Build Tool | electron-vite 5.0.0 + Vite 8.0.7 |
| UI Library | React 19.2.4 |
| Image Processing | image-js 1.5.0 |
| Styling | Tailwind CSS 4.2.2 |
| Language | TypeScript 6.0.2 |
| Packaging | Electron Forge 7.11.1 |
| Linting/Formatting | Biome |
