# Image Editor - Performance Optimization & Cleanup Plan

**Created:** April 8, 2026  
**Project:** Electron + React + Vite Image Editor  
**Current Metrics:** 915 LOC | 173ms build | 1.1MB bundle | 6.5/10 maintainability  

---

## Executive Summary

This plan addresses **5 critical issues**, **8 medium-priority improvements**, and **3 low-priority cleanups** across the codebase. Focus on quick wins (Phase 1) for immediate ROI before deeper refactoring.

**Estimated Total Time:** 8-12 hours  
**Expected Improvements:**
- 90% CPU reduction during image filtering
- UI never freezes during save operations
- 90 lines of code duplication removed
- Test coverage: 0% → 40% (critical paths)

---

## Phase 1: Quick Wins (3 hours)
*High ROI, immediate impact, low risk*

### 1.1 Extract Draggable Panel Hook
**Priority:** HIGH | **Time:** 1-2 hours | **Impact:** -90 LOC duplication

**Issue:**
- `FloatingControls` (src/renderer/components/FloatingControls.tsx:12-50) and `FloatingImage` (src/renderer/components/FloatingImage.tsx:12-50) have identical drag logic
- 40+ lines of duplicated mousedown/mousemove/mouseup handlers

**Solution:**
```
Create: src/renderer/hooks/useDraggablePanel.ts
- Extract drag state management
- Extract position update logic
- Return { isDragging, position, handlers }
```

**Files to Modify:**
- `src/renderer/components/FloatingControls.tsx` - Use hook
- `src/renderer/components/FloatingImage.tsx` - Use hook
- Create `src/renderer/hooks/useDraggablePanel.ts` - New hook

**Acceptance Criteria:**
- Both components render identically
- Drag behavior unchanged
- No console warnings
- Reduced component sizes by 40+ lines each

---

### 1.2 Add Debouncing to Filter Pipeline
**Priority:** HIGH | **Time:** 30 minutes | **Impact:** 90% CPU reduction

**Issue:**
- Filter sliders trigger full image processing 60x/second
- Filter pipeline runs even with tiny slider movements (e.g., 0.1% change)
- CPU spikes to 30-50% during slider interaction

**Location:** `src/renderer/components/BottomPanel.tsx`

**Solution:**
```typescript
// Add debounce to brightness/contrast/saturation handlers
const debouncedUpdateFilter = useCallback(
  debounce((key: string, value: number) => {
    updateFilters({ ...filters, [key]: value });
  }, 150),
  [filters]
);
```

**Implementation:**
- Add `debounce` utility function
- Wrap all filter update handlers
- Consider using `lodash.debounce` or custom implementation

**Testing:**
- Drag sliders smoothly - should not re-render every movement
- Check CPU usage during drag
- Verify final value is correct after drag stops

---

### 1.3 Convert Blocking File Save to Async
**Priority:** HIGH | **Time:** 15 minutes | **Impact:** No UI freeze

**Issue:**
- `src/main/index.ts:ipcMain.handle('save-image')` uses `fs.writeFileSync()`
- Blocks main Electron process during large file writes
- UI becomes unresponsive

**Location:** `src/main/index.ts` (save-image handler)

**Solution:**
```typescript
// Replace fs.writeFileSync with async fs.promises.writeFile
await fs.promises.writeFile(filePath, buffer);

// Add progress feedback to renderer
mainWindow?.webContents.send('save-progress', { 
  status: 'saving', 
  percentComplete: 0 
});
```

**Files to Modify:**
- `src/main/index.ts` - Use async write
- `src/preload/index.ts` - Handle progress events if needed
- `src/renderer/components/Canvas.tsx` - Show save indicator

**Acceptance Criteria:**
- App stays responsive during save
- Progress is communicated to user
- No race conditions if user saves multiple times

---

### 1.4 Replace Magic Numbers with Constants
**Priority:** MEDIUM | **Time:** 30 minutes | **Impact:** +20% maintainability

**Issue:**
- Hardcoded values scattered throughout code
- No single source of truth for dimensions, speeds, etc.

**Locations:**
- `FloatingControls.tsx:20` - `5` (drag threshold)
- `BottomPanel.tsx:45` - `0.1`, `2.0`, `100` (filter ranges)
- `Canvas.tsx:15` - `0.05` (zoom step)
- `FloatingImage.tsx:18` - `8` (resize handle size)

**Solution:**
```typescript
// Create: src/renderer/constants/ui.ts
export const UI = {
  DRAG_THRESHOLD: 5,
  RESIZE_HANDLE_SIZE: 8,
  ZOOM_STEP: 0.05,
  FILTER: {
    BRIGHTNESS_MIN: 0.1,
    BRIGHTNESS_MAX: 2.0,
    CONTRAST_MIN: 0.1,
    CONTRAST_MAX: 2.0,
    SATURATION_MAX: 100,
  },
  DEBOUNCE_DELAY_MS: 150,
};
```

**Files to Modify:**
- Create `src/renderer/constants/ui.ts`
- Update all component files to import from constants

**Acceptance Criteria:**
- No magic numbers in code
- All values documented
- Easy to adjust UI behavior globally

---

### 1.5 Remove Unused Files
**Priority:** LOW | **Time:** 5 minutes | **Impact:** Cleaner project

**Issue:**
- `vite.config.ts` appears unused (build config is in package.json electron-builder)
- Potential confusion about build system

**Solution:**
```bash
# Delete unused file
rm vite.config.ts

# Verify build still works
yarn build
```

**Acceptance Criteria:**
- Build completes successfully
- No missing config errors
- Project is cleaner

---

## Phase 2: Code Quality & Testing (3-4 hours)
*Improves maintainability and prevents regressions*

### 2.1 Add Error UI Toast Notifications
**Priority:** MEDIUM | **Time:** 1 hour | **Impact:** Better UX

**Issue:**
- Errors only appear in browser console
- Users don't know what went wrong
- No recovery guidance

**Solution:**
- Create `src/renderer/components/Toast.tsx` component
- Add error toast on image load failures
- Add success toast on save completion
- Add warning toast on large image detection

**Files to Modify:**
- Create `src/renderer/components/Toast.tsx`
- Update `Canvas.tsx` - Dispatch error toasts
- Update `src/main/index.ts` - Send error messages to renderer
- Update `App.tsx` - Mount Toast component

**Acceptance Criteria:**
- Error messages visible to user
- Non-intrusive positioning
- Auto-dismiss after 5 seconds
- Manual dismiss available

---

### 2.2 Add Unit Tests (Critical Paths)
**Priority:** MEDIUM | **Time:** 2-3 hours | **Impact:** 40% coverage, prevents regressions

**Scope (Phase 2):**
1. `useDraggablePanel.ts` hook - Drag logic
2. Filter calculation functions - Accuracy
3. IPC message handlers - Main process

**Test Files to Create:**
```
tests/
├── unit/
│   ├── hooks/
│   │   └── useDraggablePanel.test.ts
│   ├── utils/
│   │   └── filters.test.ts
│   └── main/
│       └── ipc.test.ts
└── setup.ts
```

**Testing Stack:**
- Vitest (already compatible with Vite)
- React Testing Library (components)
- Jest mocks for IPC

**Acceptance Criteria:**
- Critical paths covered (40% coverage)
- All tests pass
- CI/CD ready

---

### 2.3 Add Bounds Checking
**Priority:** MEDIUM | **Time:** 45 minutes | **Impact:** Prevent crashes

**Issue:**
- No validation on image dimensions
- No check for extremely large files
- No guard against negative dimensions from filters

**Solution:**
```typescript
// Add validation before processing
if (!isValidImageDimensions(width, height)) {
  throw new Error('Image dimensions out of bounds');
}

const MAX_DIMENSION = 16000; // pixels
const MAX_FILE_SIZE = 500; // MB
```

**Files to Modify:**
- `src/main/index.ts` - File size check
- `src/renderer/components/Canvas.tsx` - Dimension check
- Create validation utility functions

**Acceptance Criteria:**
- Large images rejected with user message
- No crashes from edge cases
- Clear error messages

---

## Phase 3: Performance & Optimization (2-3 hours)
*For large image handling and advanced scenarios*

### 3.1 Optimize Image Cloning
**Priority:** MEDIUM | **Time:** 45 minutes | **Impact:** Reduce memory spikes

**Issue:**
- Two `.clone()` calls per image load (matrix.ts and canvas)
- For 10MP images = 80MB+ temporary memory overhead
- Location: `src/renderer/components/Canvas.tsx:75-85`

**Current Code:**
```typescript
const cloned1 = image.clone(); // Used for processing
const cloned2 = image.clone(); // Used for display
```

**Solution:**
- Share single clone between processing pipeline
- Only create new clone for non-destructive edits
- Implement copy-on-write pattern

**Files to Modify:**
- `src/renderer/components/Canvas.tsx`
- Create `src/renderer/utils/imageMemory.ts`

**Acceptance Criteria:**
- Memory usage reduced by 50% for large images
- Functionality identical
- No performance regression

---

### 3.2 Implement Virtual Scrolling for Filters
**Priority:** LOW | **Time:** 1 hour | **Impact:** Prepare for scale

**Issue:**
- Currently 3 filters - simple list
- Not optimized if more filters added
- Future-proofing opportunity

**Solution:**
- Use `react-window` if filter list grows
- Lazy render filter controls
- Only mount visible filters

**Acceptance Criteria:**
- Scalable to 50+ filters without performance hit
- Smooth scrolling
- Optional for now

---

### 3.3 Add Image Processing Web Worker
**Priority:** LOW | **Time:** 1.5 hours | **Impact:** Never blocks renderer

**Issue:**
- Large image processing can freeze renderer thread
- Currently blocking for 10MP+ images
- Future-proofing for advanced filters

**Solution:**
- Create `src/renderer/workers/imageProcessor.worker.ts`
- Move heavy computation off main thread
- Use message passing for async processing

**Acceptance Criteria:**
- Renderer never freezes
- Processing completes in background
- Progress indicators work

---

## Phase 4: Documentation & Cleanup (1-2 hours)
*Optional - nice to have*

### 4.1 Add Architecture Documentation
**Priority:** LOW | **Time:** 45 minutes | **Impact:** Easier onboarding

**Create:**
- `ARCHITECTURE.md` - System design
- Component README.md files
- Hook documentation

---

### 4.2 Clean Up Unused Dependencies
**Priority:** LOW | **Time:** 30 minutes | **Impact:** Faster install

**Audit:**
```bash
npm audit
yarn outdated
# Check for unused packages
```

---

## Implementation Roadmap

### Week 1: Phase 1 (Quick Wins)
```
Day 1-2: Extract useDraggablePanel hook
Day 2-3: Add debouncing + async file save
Day 4:   Magic numbers → constants
Day 5:   Testing + verification
```

### Week 2: Phase 2 (Quality)
```
Day 1-2: Add error toast UI
Day 3-4: Unit tests for critical paths
Day 5:   Add bounds checking
```

### Week 3: Phase 3-4 (Polish)
```
Day 1-2: Optimize image cloning
Day 3:   Web workers (if needed)
Day 4-5: Documentation
```

---

## Success Metrics

### Performance
- [ ] CPU usage during filter drag: < 5% (from 30-50%)
- [ ] UI responsiveness: Zero freezes during save
- [ ] Memory overhead: 50% reduction for 10MP images

### Code Quality
- [ ] Code duplication: 90 lines removed
- [ ] Test coverage: 40% (critical paths)
- [ ] Magic numbers: 100% eliminated
- [ ] Type errors: 0 in strict mode

### User Experience
- [ ] Error messages visible in UI
- [ ] Loading/saving indicators
- [ ] No console warnings

---

## Risk Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Breaking existing functionality | HIGH | Full test suite + QA before release |
| Regression in drag behavior | MEDIUM | Capture baseline, compare visually |
| Users upgrade with issues | LOW | Semantic versioning + release notes |

---

## Dependencies & Tools

**Required:**
- TypeScript (already installed)
- Vitest (add for Phase 2)
- React Testing Library (add for Phase 2)

**Optional:**
- `lodash.debounce` (or use custom)
- `react-window` (if filter scaling needed)

---

## File Structure After Implementation

```
src/
├── main/
│   └── index.ts (async file save)
├── renderer/
│   ├── components/
│   │   ├── Canvas.tsx (image cloning, dimension checks)
│   │   ├── BottomPanel.tsx (debounced sliders)
│   │   ├── FloatingControls.tsx (use useDraggablePanel)
│   │   ├── FloatingImage.tsx (use useDraggablePanel)
│   │   └── Toast.tsx (NEW)
│   ├── hooks/
│   │   └── useDraggablePanel.ts (NEW)
│   ├── constants/
│   │   └── ui.ts (NEW)
│   ├── utils/
│   │   ├── imageMemory.ts (NEW)
│   │   └── filters.ts (NEW)
│   └── workers/
│       └── imageProcessor.worker.ts (OPTIONAL)
└── tests/ (NEW - Phase 2)
    ├── unit/
    └── setup.ts
```

---

## Review Checklist

Before marking a phase complete:
- [ ] All tests pass
- [ ] No console warnings
- [ ] Code review completed
- [ ] Performance metrics validated
- [ ] User testing (for UI changes)
- [ ] Documentation updated
- [ ] Git commits are clean and descriptive

---

## Next Steps

1. **Validate this plan** - Stakeholder review
2. **Create GitHub issues** - One issue per task
3. **Set up CI/CD** - Ensure quality gates
4. **Begin Phase 1** - Start with hook extraction
5. **Track progress** - Update completion status weekly

---

## Appendix A: Code References

### Current Code Locations
- Drag logic (FloatingControls): `src/renderer/components/FloatingControls.tsx:12-50`
- Filter pipeline (BottomPanel): `src/renderer/components/BottomPanel.tsx:45-80`
- File save (Main process): `src/main/index.ts:save-image`
- Image cloning: `src/renderer/components/Canvas.tsx:75-85`

### Dependencies Already Available
- React 18.x
- TypeScript strict mode
- Electron IPC (main/preload)
- Vite build system
- image-js library

---

**Document Version:** 1.0  
**Last Updated:** April 8, 2026  
**Owner:** Engineering Team  
**Status:** Ready for Review
