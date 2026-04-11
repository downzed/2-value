# Full Gallery Implementation Plan

> Replaces Pinterest integration with a self-contained gallery system featuring folders, image management, and SourceSplash API integration.

## Decisions

| Decision | Choice |
|---|---|
| Storage location | `app.getPath('userData')/gallery/` (app-managed) |
| Open flow | Prompt user to pick a gallery folder when opening new images |
| Save flow | Native save dialog only. Gallery is load/import only -- edited images are not saved back to gallery |
| Folder structure | Flat list, no nesting. Auto-created "Unsorted" default folder |
| Image API | SourceSplash (`api.sourcesplash.com`) - 100 req/hr free |
| Suggestion logic | Folder name + optional custom tags as search query |
| Gallery UI | Expanded right sidebar (380px) with Folders / Explore tabs |
| API key storage | `.env` file (`MAIN_VITE_SOURCESPLASH_API_KEY`), loaded by electron-vite for main process |
| Migration | Auto-migrate `recents.json` into Unsorted folder on first launch |
| Attribution | Inline text under SourceSplash thumbnails |
| Thumbnail serving | Custom Electron protocol handler (`gallery-thumb://`) registered via `protocol.handle()` |
| Duplicates | Not allowed. Detect by original file path before importing |
| Drag and drop | Not supported. Not needed |
| Gallery state persistence | Not persisted. Resets on app restart (selected folder, active tab, scroll) |
| Atomic writes | `gallery.json` written via tmp-file + rename to prevent corruption |

---

## Data Model

### New Types (`src/shared/types.ts`)

```typescript
interface GalleryFolder {
  id: string;                // crypto.randomUUID()
  name: string;
  tags: string[];            // optional search keywords for suggestions
  createdAt: number;         // Date.now()
  sortOrder: number;         // for manual reordering
}

interface GalleryImage {
  id: string;                // crypto.randomUUID()
  folderId: string;          // GalleryFolder.id
  fileName: string;          // original display name
  originalPath: string;      // where the file came from (or SourceSplash URL)
  storedFileName: string;    // filename in gallery storage (e.g., "{id}.png")
  thumbnailFileName: string; // filename of thumbnail (e.g., "{id}_thumb.png")
  width: number;
  height: number;
  fileSize: number;
  addedAt: number;
  source: 'local' | 'sourcesplash';
  sourceMetadata?: {         // for SourceSplash images only
    sourceId: string;
    author: string;
    authorUrl: string;
    description: string;
  };
}

interface GalleryData {
  version: 1;
  folders: GalleryFolder[];
  images: GalleryImage[];
}

interface SourceSplashImage {
  id: string;
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  author: string;
  author_url: string;
  source: string;
  description: string;
}

interface SourceSplashSearchResult {
  images: SourceSplashImage[];
  page: number;
  hasMore: boolean;
}
```

### Disk Layout

```
{userData}/gallery/
  gallery.json              # Master metadata (GalleryData)
  gallery.json.tmp          # Temp file for atomic writes (transient)
  images/                   # Full-resolution copies
    {image-id}.png
    {image-id}.jpg
  thumbnails/               # 200px-wide thumbnails
    {image-id}_thumb.png
```

### Special Folders

- **"Unsorted"**: Auto-created on first launch. Cannot be deleted or renamed. Default import target.

---

## Thumbnail Serving

The renderer cannot access local files via `<img src="file://...">` due to Electron security restrictions (`contextIsolation: true`). A custom protocol handler solves this cleanly.

### Implementation

Register a custom protocol in main process via `protocol.handle()`:

```typescript
// In app 'ready' handler
protocol.handle('gallery-thumb', (request) => {
  // URL format: gallery-thumb://{imageId}
  const imageId = new URL(request.url).hostname;
  const thumbPath = path.join(galleryDir, 'thumbnails', `${imageId}_thumb.png`);
  return net.fetch(pathToFileURL(thumbPath).toString());
});
```

### Usage in Renderer

```html
<img src="gallery-thumb://{imageId}" />
```

- Registered in Phase 1 alongside `initGallery()`
- Only serves files from the `gallery/thumbnails/` directory (no arbitrary file access)
- Returns 404 if thumbnail doesn't exist

---

## Duplicate Detection

Before importing an image, check if `originalPath` already exists in `gallery.json`:

- **Local images**: Compare `originalPath` against all existing `GalleryImage.originalPath` values
- **SourceSplash images**: Compare `sourceMetadata.sourceId` against existing entries
- If duplicate found: return error with the existing image's folder name so the UI can inform the user
- Applies to both `importImage()` and `downloadExternalImage()`

---

## Gallery Search (User's Own Images)

The Folders tab includes a search bar that filters across the user's own gallery:

- Text input at the top of the Folders tab: "Search gallery..."
- Filters images by `fileName` (case-insensitive substring match)
- Results shown as a flat thumbnail grid with folder name badge on each image
- Clicking a result opens the image in the editor
- Right-click context menu works the same as in folder view
- Search is client-side only (filter the in-memory `images` array). No IPC needed.

---

## SourceSplash API

### Endpoints Used

| Endpoint | Purpose | Params |
|---|---|---|
| `GET /api/random` | Random image with metadata | `q` (optional), `w`, `h` |
| `GET /api/search` | Search images | `q` (required), `page` (optional) |

### Response Format

```json
{
  "id": "pexels-123456",
  "url": "https://images.pexels.com/photos/...",
  "thumbnail": "https://images.pexels.com/photos/...",
  "width": 1920,
  "height": 1080,
  "author": "Photographer Name",
  "author_url": "https://www.pexels.com/@photographer",
  "source": "pexels",
  "description": "Image description"
}
```

### Configuration

- API key stored in `.env` file at project root: `MAIN_VITE_SOURCESPLASH_API_KEY=xxx`
- `.env` added to `.gitignore`
- Main process accesses via `import.meta.env.MAIN_VITE_SOURCESPLASH_API_KEY`
- All API requests proxied through main process using `net.fetch()` (avoids CORS)
- In-memory rate limit tracking (100 req/hr ceiling)
- Results cached: suggestions 3 min, search pages 5 min

### Suggestion Algorithm

1. Build query: `folderName` + space-joined `tags[]`
2. Call `GET /api/random?q={query}` for 6 suggestions
3. Cache results for 3 minutes (matches API rotation interval)
4. Refresh button clears cache and re-fetches

---

## Atomic Write Strategy

To prevent `gallery.json` corruption on crash:

```typescript
async function saveGallery(data: GalleryData): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const tmpPath = galleryJsonPath + '.tmp';
  await fs.promises.writeFile(tmpPath, json, 'utf-8');
  await fs.promises.rename(tmpPath, galleryJsonPath); // atomic on POSIX
  galleryCache = data; // update in-memory cache after successful write
}
```

---

## IPC Channel Design

### New Channels (14 total)

| Channel | Direction | Signature | Purpose |
|---|---|---|---|
| `gallery:get-data` | renderer -> main | `() -> GalleryData` | Full gallery data |
| `gallery:create-folder` | renderer -> main | `(name, tags?) -> GalleryFolder` | Create folder |
| `gallery:rename-folder` | renderer -> main | `(folderId, newName) -> void` | Rename folder |
| `gallery:delete-folder` | renderer -> main | `(folderId, deleteImages) -> void` | Delete folder |
| `gallery:update-folder-tags` | renderer -> main | `(folderId, tags) -> void` | Update search tags |
| `gallery:reorder-folders` | renderer -> main | `(orderedIds) -> void` | Reorder folders |
| `gallery:import-image` | renderer -> main | `(sourcePath, folderId) -> GalleryImage` | Import local image (rejects duplicates) |
| `gallery:move-image` | renderer -> main | `(imageId, targetFolderId) -> void` | Move image |
| `gallery:copy-image` | renderer -> main | `(imageId, targetFolderId) -> GalleryImage` | Copy image |
| `gallery:delete-image` | renderer -> main | `(imageId) -> void` | Delete image |
| `gallery:open-image` | renderer -> main | `(imageId) -> OpenImageResult` | Open gallery image in editor |
| `gallery:download-external` | renderer -> main | `(url, folderId, metadata) -> GalleryImage` | Download SourceSplash image (rejects duplicates) |
| `gallery:search-images` | renderer -> main | `(query, page?) -> SourceSplashSearchResult` | Proxy to SourceSplash search |
| `gallery:random-images` | renderer -> main | `(query?, count?) -> SourceSplashImage[]` | Proxy to SourceSplash random |

### Modified Existing Channels

| Channel | Change |
|---|---|
| `open-image` | After dialog returns, renderer triggers FolderPickerDialog before loading |
| `open-image-from-path` | Updated to also work with gallery image paths |

### Deprecated Channels (removed after migration)

| Channel | Replacement |
|---|---|
| `get-recents` | `gallery:get-data` |
| `remove-recent` | `gallery:delete-image` |

---

## UI Design

### Gallery Panel (380px right sidebar)

```
+----------------------------------+
| Gallery                    [x]   |
+----------------------------------+
| [Folders] [Explore]             |  <- Tab bar
+----------------------------------+
|                                  |
|  FOLDERS TAB (default)           |
|  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~    |
|  [Search gallery...           ]  |  <- search user's own images
|                                  |
|  +----------+ +----------+      |
|  | Unsorted | | Portraits|      |
|  |   (12)   | |   (8)   |      |
|  +----------+ +----------+      |
|  +----------+ +----------+      |
|  | Landscape| | + New    |      |
|  |   (5)    | |  Folder  |      |
|  +----------+ +----------+      |
|                                  |
|  -- Portraits (8) ------- [<-]  |  <- Expanded folder
|  +----+ +----+ +----+           |
|  |img1| |img2| |img3|           |
|  +----+ +----+ +----+           |
|  +----+ +----+ +----+           |
|  |img4| |img5| |img6|           |
|  +----+ +----+ +----+           |
|                                  |
|  -- Suggestions --------------- |  <- SourceSplash
|  +----+ +----+ +----+           |
|  | ss1| | ss2| | ss3|           |
|  | by | | by | | by |           |  <- inline attribution
|  +----+ +----+ +----+           |
|                                  |
|  EXPLORE TAB                     |
|  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~    |
|  [Search SourceSplash...      ]  |
|  +----+ +----+ +----+           |
|  | ss | | ss | | ss |           |
|  | by | | by | | by |           |
|  +----+ +----+ +----+           |
|        [Load More]               |
+----------------------------------+
```

### Gallery Search Results (inline in Folders tab)

When the search bar has text, the folder grid is replaced by a flat results grid:

```
+----------------------------------+
|  [Search: "sunset"         [x]]  |
|                                  |
|  +----+ +----+ +----+           |
|  |img1| |img2| |img3|           |
|  |Land | |Unso | |Port |        |  <- folder name badge
|  +----+ +----+ +----+           |
|  3 results                       |
+----------------------------------+
```

### Folder Picker Dialog (modal overlay)

```
+-------------------------------+
|  Save to folder               |
|                               |
|  +-----------+ +-----------+  |
|  | Unsorted  | | Portraits |  |
|  +-----------+ +-----------+  |
|  +-----------+ +-----------+  |
|  | Landscapes| | + New     |  |
|  +-----------+ +-----------+  |
|                               |
|       [Skip]    [Save]        |
+-------------------------------+
```

- Shown after native file dialog returns metadata
- "Skip" opens image without saving to gallery
- "Save" imports to selected folder, then opens for editing
- "+ New" creates folder inline, then selects it

### Image Context Menu (right-click on gallery thumbnail)

- Open
- Move to... (folder sub-list)
- Copy to... (folder sub-list)
- Delete

### Folder Context Menu (right-click on folder card)

- Rename
- Edit Tags
- Delete (with "delete images" vs "move to Unsorted" choice)

---

## File Changes

### New Files

| File | Purpose | Est. Lines |
|---|---|---|
| `src/main/gallery.ts` | Gallery data manager (CRUD, disk ops, migration, atomic writes, dedup) | ~350 |
| `src/main/sourcesplash.ts` | SourceSplash API client (search, random, rate limiting) | ~80 |
| `src/renderer/hooks/useGallery.ts` | Gallery state management hook | ~220 |
| `src/renderer/hooks/GalleryContext.tsx` | Gallery context provider | ~30 |
| `src/renderer/components/gallery/FolderPickerDialog.tsx` | Folder picker modal for import flow | ~120 |
| `src/renderer/components/gallery/ImageContextMenu.tsx` | Right-click menu for gallery images | ~80 |
| `src/renderer/components/gallery/FolderContextMenu.tsx` | Right-click menu for folders | ~60 |
| `.env.example` | Template for API key | ~2 |

### Modified Files

| File | Changes |
|---|---|
| `src/shared/types.ts` | Add `GalleryFolder`, `GalleryImage`, `GalleryData`, `SourceSplashImage`, `SourceSplashSearchResult` |
| `src/main/index.ts` | Add 14 IPC handlers, call `initGallery()` on app ready, register `gallery-thumb://` protocol, migration logic |
| `src/preload/index.ts` | Add 14 new `electronAPI` bridge methods |
| `src/renderer/global.d.ts` | Add gallery + SourceSplash types to `Window.electronAPI` |
| `src/renderer/hooks/useImage.ts` | Minor: `loadImage()` no longer auto-closes gallery panel |
| `src/renderer/components/shell/GalleryPanel.tsx` | Full rewrite: expanded sidebar with tabs, folders, images, search, suggestions |
| `src/renderer/components/shell/App.tsx` | Wrap with `GalleryProvider`, add `FolderPickerDialog` |
| `src/renderer/components/shell/BottomPanel.tsx` | Open button flow triggers FolderPickerDialog |
| `src/renderer/constants/ui.ts` | Add gallery constants (panel width, cache TTL, suggestion count) |
| `.gitignore` | Add `.env` |

### Removed (after migration)

| File/Code | Reason |
|---|---|
| `recents.json` handling in `src/main/index.ts` | Replaced by gallery system |
| `get-recents` IPC handler | Replaced by `gallery:get-data` |
| `remove-recent` IPC handler | Replaced by `gallery:delete-image` |

---

## Implementation Phases

### Phase 1: Gallery Foundation (Data Layer)

> Goal: Gallery CRUD works end-to-end via IPC. No UI yet.

1. **Define types** in `src/shared/types.ts`
   - `GalleryFolder`, `GalleryImage`, `GalleryData`
   - `SourceSplashImage`, `SourceSplashSearchResult`
2. **Create `src/main/gallery.ts`**
   - `initGallery()` - create dirs, create gallery.json with Unsorted folder if missing
   - `loadGallery()` / `saveGallery()` - read/write with in-memory cache, atomic writes (tmp + rename)
   - `importImage(sourcePath, folderId)` - deduplicate by originalPath, copy file, generate thumbnail, add metadata
   - `moveImage()`, `copyImage()`, `deleteImage()`
   - `createFolder()`, `renameFolder()`, `deleteFolder()`, `updateFolderTags()`, `reorderFolders()`
   - `getImagePath(imageId)` - resolve stored image to absolute path
   - `downloadExternalImage(url, folderId, metadata)` - deduplicate by sourceId, fetch + store
   - Migration: `migrateRecents()` - convert recents.json entries to gallery images in Unsorted
3. **Register `gallery-thumb://` protocol** in `src/main/index.ts`
   - `protocol.handle('gallery-thumb', ...)` - serves thumbnail files from gallery/thumbnails/
   - Registered in app `ready` handler before window creation
4. **Add IPC handlers** to `src/main/index.ts`
   - Register all 14 `gallery:*` handlers
   - Call `initGallery()` in app `ready` event
5. **Update preload bridge** (`src/preload/index.ts`)
   - Add all 14 new `electronAPI` methods
6. **Update type declarations** (`src/renderer/global.d.ts`)
   - Add all new method signatures to `Window.electronAPI`
7. **Add `.env.example`** and update `.gitignore`

**Verification**: Write unit tests for `gallery.ts` functions (create folder, import image, move, copy, delete, dedup rejection, migration, atomic write).

### Phase 2: Gallery UI - Folders

> Goal: Gallery panel shows folders, user can create/rename/delete folders.

8. **Create `useGallery` hook** (`src/renderer/hooks/useGallery.ts`)
   - State: `folders`, `images`, `selectedFolderId`, `suggestions`, `searchResults`, `gallerySearchQuery`, loading flags
   - Methods: `loadGallery()`, `createFolder()`, `renameFolder()`, `deleteFolder()`, `updateFolderTags()`
   - `filteredImages` computed property: filters images by `gallerySearchQuery` against `fileName`
   - Fetch gallery data on mount
9. **Create `GalleryContext`** (`src/renderer/hooks/GalleryContext.tsx`)
   - Same pattern as `ImageContext.tsx`
10. **Create `src/renderer/components/gallery/` directory**
    - All gallery-specific components live here (not in `shell/`)
11. **Rewrite `GalleryPanel.tsx`** (stays in `shell/`) - Phase 2 scope:
    - Wider sidebar (380px)
    - Tab bar: Folders / Explore (Explore tab empty placeholder for now)
    - Gallery search bar at top of Folders tab
    - Folder grid: 2-column cards with name + image count
    - "+ New Folder" card with inline name input
    - Search results: flat thumbnail grid with folder name badges (replaces folder grid when searching)
12. **Create `FolderContextMenu.tsx`** in `components/gallery/`
    - Right-click on folder card: Rename, Edit Tags, Delete
    - Delete shows confirmation with "delete images" vs "move to Unsorted" choice
13. **Update `App.tsx`**
    - Wrap with `GalleryProvider`
14. **Update `src/renderer/constants/ui.ts`**
    - Add `GALLERY` section: `PANEL_WIDTH`, `THUMBNAIL_COLS`, `SUGGESTION_COUNT`, `CACHE_TTL_MS`

**Verification**: Manual test - open gallery, create/rename/delete folders, search gallery. Run `yarn typecheck` and `yarn test`.

### Phase 3: Image Management

> Goal: Images can be imported, viewed, opened, moved, copied, deleted within the gallery.

15. **Create `FolderPickerDialog.tsx`** in `components/gallery/`
    - Modal overlay with folder grid
    - "+ New Folder" option
    - "Skip" and "Save" buttons
    - Receives callback: `onSelect(folderId)` / `onSkip()`
16. **Modify open-image flow**
    - `BottomPanel.tsx`: After `openImage()` returns metadata, show FolderPickerDialog
    - On "Save": call `gallery:import-image`, then `loadFromPath()`
    - On "Skip": just `loadFromPath()` as before
    - Handle duplicate rejection: show message "Image already in {folderName}" and open it anyway
17. **Add image grid to `GalleryPanel.tsx`**
    - Click folder -> expand to show 3-column thumbnail grid
    - Thumbnails loaded via `gallery-thumb://{imageId}` protocol
    - Back button to return to folder list
    - Click thumbnail -> opens image in editor (via `gallery:open-image` + `readImageBuffer`)
18. **Create `ImageContextMenu.tsx`** in `components/gallery/`
    - Right-click on thumbnail: Open, Move to..., Copy to..., Delete
    - Move/Copy show folder sub-list

**Verification**: Full flow test - open image, pick folder, see it in gallery, move/copy/delete. Verify duplicate rejection. Run `yarn typecheck` and `yarn test`.

### Phase 4: SourceSplash Integration

> Goal: Suggestions appear in folder view. Explore tab works for search/random.

19. **Create `src/main/sourcesplash.ts`**
    - `searchImages(apiKey, query, page?)` - calls `/api/search`
    - `getRandomImages(apiKey, query?, count?)` - calls `/api/random` multiple times
    - Rate limit tracker (in-memory counter, resets hourly)
    - Error handling for network failures, rate limits
20. **Add SourceSplash IPC handlers** to `src/main/index.ts`
    - `gallery:search-images` and `gallery:random-images`
    - Read API key from `import.meta.env.MAIN_VITE_SOURCESPLASH_API_KEY`
21. **Add Suggestions section to `GalleryPanel.tsx`**
    - Below image grid when a folder is selected
    - Header "Suggestions" with refresh button
    - 3-column grid of SourceSplash thumbnails
    - Inline attribution ("by {author}")
    - Click -> download to current folder + open in editor
    - Loading skeleton while fetching
    - Query built from folder name + tags
22. **Build Explore tab in `GalleryPanel.tsx`**
    - Search input (debounced 300ms)
    - Results grid (3 columns)
    - "Load More" pagination button
    - Empty state: show random images
    - Click result -> FolderPickerDialog -> download + import
    - Handle duplicate rejection on download
23. **Download flow**
    - `gallery:download-external` handler: `net.fetch(url)` -> save to gallery -> generate thumbnail
    - Deduplicate by `sourceMetadata.sourceId` before downloading
    - Show inline loading indicator on the clicked thumbnail
    - After download: image appears in folder grid

**Verification**: Test suggestions load for a folder with tags. Test search. Test download. Test duplicate rejection for SourceSplash images. Check rate limiting. Run `yarn typecheck` and `yarn test`.

### Phase 5: Polish & Testing

> Goal: Production-ready quality. All edge cases handled.

24. **Tag editor UI**
    - Inline tag editing in folder settings area
    - Comma-separated input or pill-style tags
    - Update triggers suggestion refresh
25. **Loading states & error handling**
    - Skeleton loaders for thumbnail grids
    - Error states: API failures, disk errors, missing files, duplicate rejection messages
    - Empty states: no folders, no images in folder, no suggestions, no search results, no gallery search results
    - Rate limit warning banner
26. **Keyboard shortcuts**
    - Gallery toggle: `Alt+4` (existing)
    - Navigate folders: arrow keys when gallery focused
    - Delete: `Delete` key when image selected
    - Escape: close context menus, close folder picker, back from folder view
27. **Tests**
    - Unit tests for `gallery.ts` (CRUD, migration, dedup, atomic write, edge cases)
    - Unit tests for `sourcesplash.ts` (API calls, rate limiting)
    - Unit tests for `useGallery` hook (state management, search filtering)
    - Component tests for `GalleryPanel`, `FolderPickerDialog`
    - Update existing `BottomPanel.test.tsx` for new open flow
28. **Documentation**
    - Create `src/renderer/components/gallery/ARCHITECTURE.md` with gallery system details
    - Update `AGENTS.md` with new file descriptions

---

## Security Considerations

- **File access**: Gallery images stored in app-controlled directory. `allowedPaths` set updated when opening gallery images.
- **Thumbnail protocol**: `gallery-thumb://` only serves files from `gallery/thumbnails/` directory. Path traversal prevented by using image ID lookup (UUID only, no path components).
- **API key**: Stored in `.env` with `MAIN_VITE_` prefix, never committed. `.env.example` provided as template.
- **SourceSplash requests**: Proxied through main process only. Renderer never makes direct HTTP requests.
- **Image downloads**: Only from SourceSplash API response URLs. No arbitrary URL fetching from renderer.
- **Input sanitization**: Folder names sanitized (no path separators, max length). Image IDs are UUIDs.
- **Atomic writes**: `gallery.json` written via tmp + rename to prevent corruption on crash.

## Performance Considerations

- **Gallery data cached in memory** (main process). Disk reads only on first access.
- **Thumbnails generated once** at import time (200px wide via `nativeImage`). Never re-generated.
- **Thumbnail serving**: `gallery-thumb://` protocol reads files directly from disk -- no base64 encoding, no JSON bloat.
- **SourceSplash results cached** in renderer: suggestions 3 min, search 5 min.
- **Gallery search**: Client-side filter on in-memory `images` array. No IPC round-trip needed.
- **Batch operations**: Move/copy/delete multiple images should batch metadata updates (single `saveGallery()` call).
