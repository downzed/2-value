# Gallery System Architecture

> Overview of the gallery system implementation in 2-value.

## Overview

The gallery system replaces the previous Pinterest integration with a self-contained image management system featuring:
- Local folder-based organization
- Image import from local files
- External image discovery via Pexels API
- Thumbnail generation and serving

## Data Model

### Types (`src/shared/types.ts`)

```typescript
interface GalleryFolder {
  id: string;           // crypto.randomUUID()
  name: string;
  tags: string[];       // search keywords for suggestions
  createdAt: number;
  sortOrder: number;    // for manual reordering
}

interface GalleryImage {
  id: string;
  folderId: string;
  fileName: string;
  originalPath: string;  // source file path or external URL
  storedFileName: string;
  thumbnailFileName: string;
  width: number;
  height: number;
  fileSize: number;
  addedAt: number;
  source: 'local' | 'external';
  sourceMetadata?: {
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

interface ExternalImage {
  id: string;
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  author: string;
  authorUrl: string;
  source: string;
  sourceProvider: string;
  description: string;
}
```

### Disk Layout

```
{userData}/gallery/
  gallery.json           # Master metadata
  gallery.json.tmp       # Temp file for atomic writes
  images/                # Full-resolution copies
    {image-id}.png
  thumbnails/            # 200px-wide thumbnails
    {image-id}_thumb.png
```

## Architecture Layers

### 1. Main Process (`src/main/`)

| File | Purpose |
|---|---|
| `gallery.ts` | Data layer: CRUD operations, atomic writes, duplicate detection, migration |
| `image-provider.ts` | Provider interface + rate limiting |
| `providers/pexels.ts` | Pexels API implementation |
| `index.ts` | IPC handlers, protocol registration |

### 2. Preload Bridge (`src/preload/`)

Exposes gallery methods via `window.electronAPI`:
- `galleryGetData()`, `galleryCreateFolder()`, `galleryRenameFolder()`, `galleryDeleteFolder()`
- `galleryImportImage()`, `galleryMoveImage()`, `galleryCopyImage()`, `galleryDeleteImage()`
- `galleryOpenImage()`, `galleryDownloadExternal()`
- `gallerySearchImages()`, `galleryRandomImages()`

### 3. Renderer (`src/renderer/`)

| File | Purpose |
|---|---|
| `hooks/useGallery.ts` | State management for gallery (folders, images, suggestions, search) |
| `hooks/GalleryContext.tsx` | React context provider |
| `components/shell/GalleryPanel.tsx` | Main gallery UI (sidebar, tabs, grids) |
| `components/gallery/FolderPickerDialog.tsx` | Folder selection modal |
| `components/gallery/FolderContextMenu.tsx` | Folder right-click menu + dialogs |
| `components/gallery/ImageContextMenu.tsx` | Image right-click menu |

## Key Implementation Details

### Thumbnail Serving

Uses custom Electron protocol `gallery-thumb://`:

```typescript
// Main process
protocol.handle('gallery-thumb', (request) => {
  const imageId = new URL(request.url).hostname;
  const thumbPath = path.join(galleryDir, 'thumbnails', `${imageId}_thumb.png`);
  return net.fetch(pathToFileURL(thumbPath).toString());
});
```

```tsx
// Renderer
<img src="gallery-thumb://{imageId}" />
```

### Rate Limiting

- Pexels: 200 requests/hour (free tier)
- In-memory tracking with hourly window reset
- Rate limit errors displayed as amber banner in UI

### Suggestions

Generated from folder name + tags:
1. Build query: `folderName + " " + tags.join(" ")`
2. Call Pexels `/v1/search` endpoint
3. Cache results for 3 minutes
4. Refresh button clears cache

### Duplicate Detection

- Local images: Compare `originalPath`
- External images: Compare `sourceMetadata.sourceId`
- Rejects duplicates with error message

### Atomic Writes

`gallery.json` written via temp file + rename to prevent corruption:
```typescript
await fs.promises.writeFile(tmpPath, json, 'utf-8');
await fs.promises.rename(tmpPath, galleryJsonPath);
```

## IPC Channels

| Channel | Purpose |
|---|---|
| `gallery:get-data` | Full gallery state |
| `gallery:create-folder` | Create new folder |
| `gallery:rename-folder` | Rename folder |
| `gallery:delete-folder` | Delete folder (with images or move to Unsorted) |
| `gallery:update-folder-tags` | Update folder tags |
| `gallery:import-image` | Import local image |
| `gallery:move-image` | Move image between folders |
| `gallery:copy-image` | Copy image to another folder |
| `gallery:delete-image` | Delete image |
| `gallery:open-image` | Open gallery image in editor |
| `gallery:download-external` | Download external image to gallery |
| `gallery:search-images` | Search external provider |
| `gallery:random-images` | Get random images from provider |

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+1` / `Alt+1` | Toggle controls panel |
| `Ctrl+2` / `Alt+2` | Toggle original panel |
| `Ctrl+3` / `Alt+3` | Toggle timer panel |
| `Ctrl+4` / `Alt+4` | Toggle gallery panel |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+0` | Fit to view |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Escape` | Close context menus, folder picker, back from folder view |

## Testing

- Unit tests for `gallery.ts` (CRUD, migration, dedup, atomic write)
- Unit tests for `providers/pexels.ts` (API calls, rate limiting)
- Unit tests for `useGallery` hook (state management, search filtering)
- Component tests for `GalleryPanel`, `FolderPickerDialog`
