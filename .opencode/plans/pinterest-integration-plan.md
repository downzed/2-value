# Pinterest Integration Plan — Fetch Boards & Browse Images in Gallery

## Scope

Authenticate with Pinterest, browse boards, see pin thumbnails in the Gallery panel, and load any pin image into the editor. No saving/writing to Pinterest.

## Decisions

- Pinterest boards integrate **into the existing GalleryPanel** (tabs: Recents | Pinterest) — not a separate panel
- All save-pin scaffolding is **stripped out** — only fetching/browsing
- OAuth callback uses **custom protocol handler** (`imageapp://`)
- Pin images use `736x` variant for editor loading, `236x` for thumbnails
- Scopes reduced to `boards:read` + `pins:read` (no `pins:write`)
- Privacy policy hosted via **GitHub Pages** from `docs/privacy.html`

---

## Current State Assessment

The `copilot/add-pinterest-integration-scaffolding` branch already has:

| Layer | What exists | Status |
|-------|------------|--------|
| Main process | `pinterest-auth.ts` (full OAuth + safeStorage token persistence) | Complete but **no custom protocol handler registered** — callback can never land |
| Main process | `pinterest-api.ts` (fetchBoards, fetchBoardPins, savePin) | fetchBoards/fetchBoardPins work; savePin will be removed |
| IPC handlers | Auth, auth-callback, auth-status, logout, get-boards, save-pin | Missing: **get-board-pins**, **download-pin-image**. save-pin will be removed |
| Preload | Pinterest methods exposed | Missing: pins + image download. save-pin will be removed |
| Renderer | `PinterestPanel.tsx` (save-focused), `PinterestContext.tsx`, `usePinterestAuth.ts` | PinterestPanel will be **deleted**; context will be reworked for browsing |
| Types | `pinterest-types.ts` (Board, Pin, SavePinArgs, etc.) | Save types will be removed |
| GalleryPanel | Shows recents only | Needs Pinterest tab |

---

## Phase 0 — Privacy Policy (GitHub Pages)

**Files:** `docs/privacy.html` (new)

Pinterest developer guidelines require a publicly accessible privacy policy URL at app registration time.

1. Create `docs/privacy.html` with a minimal, honest privacy policy covering:
   - App stores a Pinterest OAuth token locally, encrypted via Electron safeStorage
   - Board/pin metadata fetched on-demand, not persisted
   - No data sent anywhere except Pinterest's own API
   - No analytics, tracking, or third-party sharing
   - Disconnect at any time to delete stored credentials
2. Enable GitHub Pages on the repo (source: `docs/` folder on main branch)
3. Use the resulting URL (`https://<user>.github.io/2-value/privacy.html`) when registering the Pinterest app

---

## Phase 1 — Complete the OAuth Flow (custom protocol handler)

**Files:** `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/global.d.ts`

The scaffolding defines `PINTEREST_REDIRECT_URI = 'imageapp://pinterest/callback'` and has the `pinterest:auth-callback` IPC handler, but no OS-level protocol registration exists. The system browser redirect goes nowhere.

1. Register `imageapp` as default protocol client via `app.setAsDefaultProtocolClient('imageapp')` — call before `app.whenReady()`
2. Handle the deep link callback:
   - **macOS:** `app.on('open-url', (event, url) => ...)` — parse `imageapp://pinterest/callback?code=...&state=...`, extract `code` and `state`, call `handleOAuthCallback(code, state, redirectUri)`
   - **Windows/Linux:** `app.on('second-instance', (event, argv) => ...)` — extract URL from last argv entry
3. After successful callback, push event to renderer: `mainWindow.webContents.send('pinterest:auth-complete')`
4. Preload: expose `onPinterestAuthComplete: (cb: () => void) => () => void` (returns unsubscribe function)
5. Update `global.d.ts` with the new listener type

---

## Phase 2 — Wire Up Pin Fetching + Image Download IPC

**Files:** `src/main/index.ts`, `src/main/pinterest-api.ts`, `src/preload/index.ts`, `src/renderer/global.d.ts`, `src/shared/pinterest-types.ts`

### Add

1. **IPC handler `pinterest:get-board-pins`**
   - Accepts `{ boardId: string, bookmark?: string }`
   - Calls existing `fetchBoardPins(boardId, bookmark)` from `pinterest-api.ts`
   - Returns `PinterestPaginatedResponse<PinterestPin>` (includes `items` + `bookmark` for pagination)

2. **IPC handler `pinterest:download-pin-image`**
   - Accepts `{ url: string }` (Pinterest CDN image URL, e.g. the `736x` variant)
   - Downloads image bytes via `fetch()` in the main process (avoids CORS issues the renderer would hit)
   - Returns `Uint8Array` — same pattern as `read-image-buffer`

3. **Preload bridge additions:**
   ```ts
   pinterestGetBoardPins: (boardId: string, bookmark?: string) => Promise<PinterestPaginatedResponse<PinterestPin>>
   pinterestDownloadImage: (url: string) => Promise<Uint8Array>
   onPinterestAuthComplete: (callback: () => void) => () => void  // returns unsubscribe
   ```

4. **Update `global.d.ts`** with these three new methods

### Remove

5. Delete `savePin` export from `pinterest-api.ts`
6. Delete `pinterest:save-pin` IPC handler from `src/main/index.ts`
7. Delete `pinterestSavePin` from preload bridge and `global.d.ts`
8. Remove `SavePinArgs`, `SavePinResult` from `src/shared/pinterest-types.ts`
9. Change scopes in `src/main/pinterest-auth.ts` from `['boards:read', 'pins:read', 'pins:write']` to `['boards:read', 'pins:read']`

---

## Phase 3 — Rework PinterestContext for Browsing

**Files:** `src/renderer/context/PinterestContext.tsx`, `src/renderer/hooks/usePinterestAuth.ts`

1. **Strip save-related state** from context (`savePin` method and all save status)

2. **Add browsing state:**
   ```ts
   boards: PinterestBoard[]
   selectedBoard: PinterestBoard | null
   pins: PinterestPin[]           // pins for the selected board
   pinsBookmark: string | null    // pagination cursor
   isLoadingPins: boolean
   ```

3. **Add browsing actions:**
   ```ts
   fetchBoards: () => Promise<void>
   selectBoard: (board: PinterestBoard | null) => void  // triggers pin fetch
   fetchPins: (boardId: string, bookmark?: string) => Promise<void>
   loadMorePins: () => Promise<void>  // appends next page using pinsBookmark
   ```

4. **Update `usePinterestAuth`:**
   - Listen for the `pinterest:auth-complete` push event from main process via `onPinterestAuthComplete`
   - On receiving it, set `isAuthenticated = true` and auto-trigger `fetchBoards()`
   - Return cleanup function for the listener

5. Auto-fetch boards on mount when already authenticated (existing behavior, keep it)

---

## Phase 4 — Integrate into GalleryPanel

**Files:** `src/renderer/components/shell/GalleryPanel.tsx`, `src/renderer/constants/ui.ts`

This is the main UI change. GalleryPanel gets two tabs.

1. **Tab bar** at the top of GalleryPanel body:
   - `Recents` tab — current thumbnail grid (unchanged)
   - `Pinterest` tab — boards + pins view

2. **Pinterest tab states:**
   - **Not authenticated:** "Connect Pinterest" button (calls `initiateAuth` from context)
   - **Authenticated, loading boards:** "Loading boards..." text
   - **Authenticated, boards loaded:** Board selector dropdown (board name + pin count), followed by pin thumbnail grid
   - **Board selected, loading pins:** Spinner/skeleton in grid area
   - **Board selected, pins loaded:** Grid of pin thumbnails. Each thumbnail clickable.
   - **Pagination:** "Load more" button at grid bottom when `pinsBookmark` is non-null

3. **Pin thumbnail click → load image into editor:**
   - Call `pinterestDownloadImage(pin.media.images['736x'].url)` to get full-res bytes as `Uint8Array`
   - Decode using existing `decodeBytesToImage()` from `useImageLoader.ts`
   - Call `loadImage(image, pinTitle || 'Pinterest Pin', '')` — no filePath since it's not a local file
   - Close the gallery panel after loading

4. **Pin thumbnail rendering:**
   - Use `<img src={pin.media.images['236x'].url}>` directly for thumbnails (public Pinterest CDN URLs, no CORS issue for `<img>` tags)
   - Show pin title below the thumbnail (truncated)

5. **Add constants to `ui.ts`:**
   ```ts
   PINTEREST: {
     PINS_PER_PAGE: 25,
     THUMBNAIL_SIZE: '236x',
     FULL_SIZE: '736x',
   }
   ```

6. **Disconnect option:** Small "Disconnect" link at bottom of Pinterest tab when authenticated (calls `logout`)

---

## Phase 5 — Cleanup & Delete Dead Code

**Files:** multiple

| Action | File |
|--------|------|
| **Delete** | `src/renderer/components/PinterestPanel.tsx` |
| **Delete** | `src/renderer/constants/pinterest.ts` |
| Remove PinterestPanel import/usage | `src/renderer/components/shell/App.tsx` |
| Remove `pinterest` from `PanelId` + `DEFAULT_PANELS` | `src/renderer/hooks/useImage.ts` |
| Remove Pinterest panel toggle icon | `src/renderer/components/shell/BottomPanel.tsx` |
| Keep `PinterestProvider` in `App.tsx` | Lightweight when not authenticated; GalleryPanel consumes it |

---

## Data Flow

```
User clicks "Connect Pinterest" in Gallery → Pinterest tab
  → renderer: PinterestContext.initiateAuth()
  → IPC: pinterest:auth
  → main: initiateOAuthFlow() → shell.openExternal(authUrl)
  → System browser: Pinterest OAuth consent screen
  → Redirect to imageapp://pinterest/callback?code=...&state=...
  → main: app.on('open-url') → handleOAuthCallback(code, state, redirectUri)
  → main: token encrypted + persisted via safeStorage
  → main: mainWindow.webContents.send('pinterest:auth-complete')
  → renderer: usePinterestAuth listener fires → isAuthenticated = true
  → PinterestContext auto-fetches boards

User selects a board from dropdown
  → renderer: PinterestContext.selectBoard(board)
  → IPC: pinterest:get-board-pins { boardId }
  → main: fetchBoardPins(boardId) → Pinterest API v5
  → renderer: pins[] populated → thumbnail grid renders

User clicks a pin thumbnail
  → IPC: pinterest:download-pin-image { url: pin.media.images['736x'].url }
  → main: fetch(url) → Uint8Array response
  → renderer: decodeBytesToImage(bytes) → image-js Image
  → renderer: loadImage(image, title, '') → editor canvas updates
  → Gallery panel closes
```

---

## File Change Summary

| File | Action |
|------|--------|
| `docs/privacy.html` | **Create** — privacy policy for Pinterest app registration |
| `src/main/index.ts` | Add protocol handler registration, `open-url` + `second-instance` listeners, push event, `get-board-pins` + `download-pin-image` IPC. Remove `save-pin` IPC |
| `src/main/pinterest-api.ts` | Remove `savePin` export |
| `src/main/pinterest-auth.ts` | Change scopes: remove `pins:write` |
| `src/preload/index.ts` | Add `pinterestGetBoardPins`, `pinterestDownloadImage`, `onPinterestAuthComplete`. Remove `pinterestSavePin` |
| `src/renderer/global.d.ts` | Match preload changes |
| `src/shared/pinterest-types.ts` | Remove `SavePinArgs`, `SavePinResult` |
| `src/renderer/context/PinterestContext.tsx` | Rework: remove save logic, add pins browsing state + actions |
| `src/renderer/hooks/usePinterestAuth.ts` | Add `onPinterestAuthComplete` listener for push event |
| `src/renderer/components/shell/GalleryPanel.tsx` | Add tab bar (Recents / Pinterest), board selector, pin grid, image loading |
| `src/renderer/constants/ui.ts` | Add `PINTEREST` constants block |
| `src/renderer/components/shell/App.tsx` | Remove PinterestPanel import and JSX |
| `src/renderer/components/shell/BottomPanel.tsx` | Remove Pinterest panel toggle icon |
| `src/renderer/hooks/useImage.ts` | Remove `pinterest` from `PanelId` union and `DEFAULT_PANELS` |
| `src/renderer/components/PinterestPanel.tsx` | **Delete** |
| `src/renderer/constants/pinterest.ts` | **Delete** |

---

## Integration Fit Points (cross-reference)

| Concern | Resolution |
|---------|-----------|
| OAuth token storage | Already handled — `safeStorage` encryption in `pinterest-auth.ts` |
| New IPC channels | `pinterest:get-board-pins`, `pinterest:download-pin-image`, push event `pinterest:auth-complete`. Added to `src/main/index.ts`, exposed in preload + `global.d.ts` |
| UI panel | No separate panel — integrated as a tab inside GalleryPanel. `PanelId` loses `pinterest` entry |
| Thumbnail fetching | `<img>` tags point directly at Pinterest CDN `236x` URLs (no CORS for img). Full image downloaded via main-process fetch returning `Uint8Array` (mirrors `read-image-buffer` pattern) |
| Gallery integration | GalleryPanel extended with tab bar: Recents tab (unchanged) + Pinterest tab (boards dropdown + pin grid) |
| Constants | `PINTEREST` block added to `src/renderer/constants/ui.ts` |
