import { useState, useEffect, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Generation, ModelInfo, ListFilter, SelfHostedStatus, Collection, TodayCost } from './lib/types';
import * as api from './lib/api';
import { useGenerations } from './hooks/useGenerations';
import { useTags } from './hooks/useTags';
import { useKeyboard } from './hooks/useKeyboard';
import { useGenerate } from './hooks/useGenerate';
import { useJobs } from './hooks/useJobs';
import { useSettings } from './hooks/useSettings';
import { Sidebar } from './components/Sidebar';
import { Gallery } from './components/Gallery';
import { Details } from './components/Details';
import { GenerateModal, type GenerateModalInitialState } from './components/GenerateModal';
import { Compare } from './components/Compare';
import { Dashboard } from './components/Dashboard';
import { Cheatsheet } from './components/Cheatsheet';
import { ContextMenu } from './components/ContextMenu';
import { Lightbox } from './components/Lightbox';
import { JobsIndicator } from './components/JobsIndicator';
import { RemixModal } from './components/RemixModal';
import { GalleryPickerModal } from './components/GalleryPickerModal';
import { Settings } from './components/Settings';
import { TagFilterBar } from './components/TagFilterBar';
import { BatchActionBar } from './components/BatchActionBar';
import type { Reference } from './lib/types';

type View = 'gallery' | 'compare' | 'dashboard';

export default function App() {
  // Filter state
  const [filter, setFilter] = useState<ListFilter>({ limit: 100, starred_only: false, show_trashed: false, uncategorized: false });
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterModel, setFilterModel] = useState<string | null>(null);
  const [starredOnly, setStarredOnly] = useState(false);

  // Sidebar navigation state
  const [activeCollection, setActiveCollection] = useState<number | null>(null);
  const [showTrashed, setShowTrashed] = useState(false);
  const [showUncategorized, setShowUncategorized] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);

  // Selection state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [markedIds, setMarkedIds] = useState<Set<number>>(new Set());
  const [anchorId, setAnchorId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<[number, number] | null>(null);
  const [batchTagOpen, setBatchTagOpen] = useState(false);

  // UI state
  const [view, setView] = useState<View>('gallery');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateInitialState, setGenerateInitialState] = useState<GenerateModalInitialState | undefined>(undefined);
  const [showHelp, setShowHelp] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    generation: Generation;
    position: { x: number; y: number };
  } | null>(null);

  // Remix state
  const [remixOpen, setRemixOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [remixReferences, setRemixReferences] = useState<Reference[]>([]);

  // Models
  const [cloudModels, setCloudModels] = useState<ModelInfo[]>([]);
  const [selfHostedStatus, setSelfHostedStatus] = useState<SelfHostedStatus | null>(null);

  // Today's cost
  const [todayCost, setTodayCost] = useState<TodayCost>({ total: 0, byModel: [] });

  // Combined model list: self-hosted first (if connected), then cloud
  const models = useMemo(() => {
    const result: ModelInfo[] = [];

    // Add self-hosted models at top if server is connected
    if (selfHostedStatus?.connected && selfHostedStatus.available_models.length > 0) {
      for (const modelId of selfHostedStatus.available_models) {
        result.push({
          id: modelId,
          provider: 'selfhosted',
          display_name: `${modelId} (Local)`,
          cost_per_image: 0,
          max_refs: 1,
        });
      }
    }

    // Add cloud models
    result.push(...cloudModels);

    return result;
  }, [cloudModels, selfHostedStatus]);

  // Hooks
  const { hiddenTags, toggleHiddenTag, thumbnailSize, setThumbnailSize } = useSettings();
  const { tags: allTags, addTags, removeTag, refresh: refreshTags } = useTags();
  const { generating, progress: generateProgress, error: generateError, generate } = useGenerate();
  const { jobs, activeCount, failedJobs, failedCount, dismissFailedJob } = useJobs();

  // Build filter with exclude_tags for server-side hidden tag filtering
  const generationsFilter = useMemo(() => ({
    ...filter,
    exclude_tags: hiddenTags.length > 0 ? hiddenTags : undefined,
  }), [filter, hiddenTags]);

  const { generations, loading, loadingMore, hasMore, refresh, loadMore } = useGenerations({ filter: generationsFilter });

  // Filter out hidden tags from sidebar (client-side is fine for tag list)
  const tags = useMemo(
    () => allTags.filter((t) => !hiddenTags.includes(t.name)),
    [allTags, hiddenTags]
  );

  const refreshTodayCost = useCallback(() => {
    api.getCostSummary('today').then((s) => {
      setTodayCost({ total: s.total_usd, byModel: s.by_model });
    }).catch(() => {});
  }, []);

  // Load models, collections, and today's cost on mount
  useEffect(() => {
    api.listModels().then(setCloudModels);
    api.checkSelfhostedHealth().then(setSelfHostedStatus);
    api.listCollections().then(setCollections).catch(() => {});
    refreshTodayCost();
  }, [refreshTodayCost]);

  const refreshCollections = useCallback(() => {
    api.listCollections().then(setCollections).catch(() => {});
  }, []);

  // Refresh self-hosted status (called when settings change)
  const refreshSelfHostedStatus = useCallback(() => {
    api.checkSelfhostedHealth().then(setSelfHostedStatus);
  }, []);

  // Listen for new generations from CLI/external sources
  useEffect(() => {
    const unlisten = listen('generation-added', () => {
      refresh();
      refreshTags();
      refreshCollections();
      refreshTodayCost();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refresh, refreshTags, refreshCollections, refreshTodayCost]);

  // Update filter when tags/model/starred/collection/trash/uncategorized changes
  useEffect(() => {
    setFilter((prev) => ({
      ...prev,
      tags: filterTags.length > 0 ? filterTags : undefined,
      model: filterModel || undefined,
      starred_only: starredOnly,
      collection_id: activeCollection || undefined,
      show_trashed: showTrashed,
      uncategorized: showUncategorized,
    }));
  }, [filterTags, filterModel, starredOnly, activeCollection, showTrashed, showUncategorized]);

  // Sidebar navigation handlers (mutually exclusive)
  const handleShowAll = useCallback(() => {
    setStarredOnly(false);
    setShowTrashed(false);
    setShowUncategorized(false);
    setActiveCollection(null);
    setFilterTags([]);
  }, []);

  const handleShowStarred = useCallback(() => {
    setStarredOnly(true);
    setShowTrashed(false);
    setShowUncategorized(false);
    setActiveCollection(null);
  }, []);

  const handleShowTrashed = useCallback(() => {
    setShowTrashed(true);
    setStarredOnly(false);
    setShowUncategorized(false);
    setActiveCollection(null);
  }, []);

  const handleShowUncategorized = useCallback(() => {
    setShowUncategorized(true);
    setStarredOnly(false);
    setShowTrashed(false);
    setActiveCollection(null);
  }, []);

  const handleSelectCollection = useCallback((id: number) => {
    setActiveCollection(id);
    setStarredOnly(false);
    setShowTrashed(false);
    setShowUncategorized(false);
  }, []);

  const handleCreateCollection = useCallback(async (name: string) => {
    await api.createCollection(name);
    refreshCollections();
  }, [refreshCollections]);

  // Tag filter handlers
  const addFilterTag = useCallback((tag: string) => {
    setFilterTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }, []);

  const removeFilterTag = useCallback((tag: string) => {
    setFilterTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const clearFilterTags = useCallback(() => {
    setFilterTags([]);
  }, []);

  // Selected generation
  const selectedGeneration = useMemo(
    () => generations.find((g) => g.id === selectedId) || null,
    [generations, selectedId]
  );

  // Compare generations
  const compareGenerations = useMemo(() => {
    if (!compareIds) return null;
    const left = generations.find((g) => g.id === compareIds[0]);
    const right = generations.find((g) => g.id === compareIds[1]);
    if (!left || !right) return null;
    return { left, right };
  }, [generations, compareIds]);

  // Navigation
  const currentIndex = useMemo(() => {
    if (!selectedId || generations.length === 0) return -1;
    return generations.findIndex((g) => g.id === selectedId);
  }, [generations, selectedId]);

  const hasNext = currentIndex >= 0 && currentIndex < generations.length - 1;
  const hasPrevious = currentIndex > 0;

  const selectNext = useCallback(() => {
    if (generations.length === 0) return;
    const idx = selectedId
      ? generations.findIndex((g) => g.id === selectedId)
      : -1;
    const nextIndex = Math.min(idx + 1, generations.length - 1);
    setSelectedId(generations[nextIndex].id);
  }, [generations, selectedId]);

  const selectPrevious = useCallback(() => {
    if (generations.length === 0) return;
    const idx = selectedId
      ? generations.findIndex((g) => g.id === selectedId)
      : generations.length;
    const prevIndex = Math.max(idx - 1, 0);
    setSelectedId(generations[prevIndex].id);
  }, [generations, selectedId]);

  // Actions
  const handleToggleStar = useCallback(async () => {
    if (!selectedId) return;
    await api.toggleStarred(selectedId);
    refresh();
  }, [selectedId, refresh]);

  const handleUpdateTitle = useCallback(async (title: string | null) => {
    if (!selectedId) return;
    await api.updateTitle(selectedId, title);
    refresh();
  }, [selectedId, refresh]);

  const handleAddTag = useCallback(async (tag: string) => {
    if (!selectedId) return;
    await addTags(selectedId, [tag]);
    refresh();
  }, [selectedId, addTags, refresh]);

  const handleRemoveTag = useCallback(async (tag: string) => {
    if (!selectedId) return;
    await removeTag(selectedId, tag);
    refresh();
  }, [selectedId, removeTag, refresh]);

  // Open remix modal with current generation's references
  const handleOpenRemix = useCallback(() => {
    if (!selectedGeneration) return;
    setRemixReferences([...selectedGeneration.references]);
    setRemixOpen(true);
  }, [selectedGeneration]);

  // Open generate modal with current image as a reference
  const handleOpenReference = useCallback(() => {
    if (!selectedGeneration) return;
    const lineage = selectedGeneration.references.map((ref) => ({
      id: ref.id,
      path: ref.path,
      thumbPath: null,
    }));
    setGenerateInitialState({
      references: [{
        id: selectedGeneration.id,
        path: selectedGeneration.image_path,
        thumbPath: selectedGeneration.thumb_path,
      }],
      lineage,
    });
    setGenerateOpen(true);
  }, [selectedGeneration]);

  // Generate from remix modal
  const handleRemixGenerate = useCallback(async (prompt: string, model: string, referencePaths: string[], tags: string[], numRuns: number = 1) => {
    if (!selectedGeneration) return;
    // Close modals immediately
    setRemixOpen(false);
    setPickerOpen(false);
    // Generate in background
    const results = await generate({
      prompt,
      model,
      tags,
      reference_paths: referencePaths,
      copy_to: null,
      negative_prompt: null,
      width: null,
      height: null,
    }, numRuns);
    if (results.length > 0) {
      refresh();
      refreshTags();
      refreshTodayCost();
      setSelectedId(results[results.length - 1].id);
    }
  }, [selectedGeneration, generate, refresh, refreshTags, refreshTodayCost]);

  // Add reference from gallery picker
  const handleAddReferenceFromPicker = useCallback((generation: Generation) => {
    // Create a pseudo-reference from the generation
    const newRef: Reference = {
      id: generation.id, // Using generation id as ref id for tracking
      hash: '', // Not needed for display
      path: generation.image_path,
      created_at: generation.created_at,
    };
    // Don't add duplicates
    setRemixReferences((prev) => {
      if (prev.some((r) => r.path === newRef.path)) {
        return prev;
      }
      return [...prev, newRef];
    });
  }, []);

  // Remove reference
  const handleRemoveRemixReference = useCallback((refId: number) => {
    setRemixReferences((prev) => prev.filter((r) => r.id !== refId));
  }, []);

  const handleTrash = useCallback(async () => {
    if (!selectedId) return;
    await api.trashGeneration(selectedId);
    setSelectedId(null);
    setDetailsOpen(false);
    refresh();
  }, [selectedId, refresh]);

  // Context menu handlers (work with any generation)
  const handleContextMenuToggleStar = useCallback(async (id: number) => {
    await api.toggleStarred(id);
    refresh();
  }, [refresh]);

  const handleContextMenuTrash = useCallback(async (id: number) => {
    await api.trashGeneration(id);
    if (selectedId === id) {
      setSelectedId(null);
      setDetailsOpen(false);
    }
    refresh();
  }, [selectedId, refresh]);

  const handleGenerate = useCallback(async (prompt: string, model: string, genTags: string[], referencePaths: string[], negativePrompt: string | null = null, numRuns: number = 1) => {
    setGenerateOpen(false);
    const results = await generate({
      prompt,
      model,
      tags: genTags,
      reference_paths: referencePaths,
      copy_to: null,
      negative_prompt: negativePrompt,
      width: null,
      height: null,
    }, numRuns);
    if (results.length > 0) {
      refresh();
      refreshTags();
      refreshTodayCost();
      setSelectedId(results[results.length - 1].id);
    }
  }, [generate, refresh, refreshTags, refreshTodayCost]);

  // Multi-selection handlers
  const handleSelect = useCallback((id: number, event: React.MouseEvent) => {
    if (event.metaKey || event.ctrlKey) {
      // Cmd/Ctrl+click: Toggle mark (don't open details)
      setMarkedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      setAnchorId(id);
      setSelectedId(id);
    } else if (event.shiftKey && anchorId !== null) {
      // Shift+click: Range select (don't open details)
      const anchorIndex = generations.findIndex((g) => g.id === anchorId);
      const clickIndex = generations.findIndex((g) => g.id === id);
      if (anchorIndex !== -1 && clickIndex !== -1) {
        const start = Math.min(anchorIndex, clickIndex);
        const end = Math.max(anchorIndex, clickIndex);
        const rangeIds = generations.slice(start, end + 1).map((g) => g.id);
        setMarkedIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((rid) => next.add(rid));
          return next;
        });
      }
      setSelectedId(id);
    } else {
      // Plain click: Select single, clear marks, open details
      setMarkedIds(new Set());
      setAnchorId(id);
      setSelectedId(id);
      setDetailsOpen(true);
    }
  }, [generations, anchorId]);

  const handleMark = useCallback(() => {
    if (!selectedId) return;
    setMarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(selectedId)) {
        next.delete(selectedId);
      } else {
        next.add(selectedId);
      }
      return next;
    });
  }, [selectedId]);

  const handleClearSelection = useCallback(() => {
    setMarkedIds(new Set());
    setBatchTagOpen(false);
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (markedIds.size === 0) return;
    await api.trashGenerations([...markedIds]);
    if (selectedId && markedIds.has(selectedId)) {
      setSelectedId(null);
      setDetailsOpen(false);
    }
    setMarkedIds(new Set());
    refresh();
  }, [markedIds, selectedId, refresh]);

  const handleBatchTag = useCallback(async (tag: string) => {
    if (markedIds.size === 0) return;
    for (const id of markedIds) {
      await addTags(id, [tag]);
    }
    refresh();
    refreshTags();
  }, [markedIds, addTags, refresh, refreshTags]);

  const handleUseAsRefs = useCallback(() => {
    if (markedIds.size === 0) return;
    const refs = generations
      .filter((g) => markedIds.has(g.id))
      .map((g) => ({
        id: g.id,
        path: g.image_path,
        thumbPath: g.thumb_path,
      }));
    setGenerateInitialState({ references: refs });
    setGenerateOpen(true);
  }, [markedIds, generations]);

  const handleCompare = useCallback(() => {
    if (markedIds.size === 2) {
      const ids = [...markedIds] as [number, number];
      setCompareIds(ids);
      setView('compare');
    }
  }, [markedIds]);

  const handleBatchRegen = useCallback(() => {
    if (markedIds.size === 0) return;
    // Use marked generations as refs, pre-fill from first selected
    const markedGenerations = generations.filter((g) => markedIds.has(g.id));
    if (markedGenerations.length === 0) return;
    const first = markedGenerations[0];
    const refs = markedGenerations.map((g) => ({
      id: g.id,
      path: g.image_path,
      thumbPath: g.thumb_path,
    }));
    setGenerateInitialState({
      prompt: first.prompt,
      model: first.model,
      tags: first.tags,
      references: refs,
    });
    setGenerateOpen(true);
  }, [markedIds, generations]);

  // Keyboard shortcuts
  useKeyboard({
    onNext: selectNext,
    onPrevious: selectPrevious,
    onToggleStar: handleToggleStar,
    onOpenDetails: () => selectedId && setDetailsOpen(true),
    onCompare: () => {
      if (markedIds.size === 2) {
        const ids = [...markedIds] as [number, number];
        setCompareIds(ids);
        setView('compare');
      }
    },
    onRegenerate: handleOpenRemix,
    onFocusGenerate: () => {
      setGenerateInitialState(undefined);
      setGenerateOpen(true);
    },
    onFocusSearch: () => document.getElementById('tag-filter-input')?.focus(),
    onShowHelp: () => setShowHelp(true),
    onEscape: () => {
      if (lightboxOpen) {
        setLightboxOpen(false);
      } else if (contextMenu) {
        setContextMenu(null);
      } else if (settingsOpen) {
        setSettingsOpen(false);
      } else if (pickerOpen) {
        setPickerOpen(false);
      } else if (remixOpen) {
        setRemixOpen(false);
      } else if (showHelp) {
        setShowHelp(false);
      } else if (view !== 'gallery') {
        setView('gallery');
        setCompareIds(null);
      } else if (markedIds.size > 0 || batchTagOpen) {
        setMarkedIds(new Set());
        setBatchTagOpen(false);
      } else if (detailsOpen) {
        setDetailsOpen(false);
      } else if (generateOpen) {
        setGenerateOpen(false);
      } else {
        setSelectedId(null);
      }
    },
    onDelete: handleTrash,
    // Batch selection handlers
    onMark: handleMark,
    onClearSelection: handleClearSelection,
    onBatchTag: () => setBatchTagOpen(true),
    onBatchRefs: handleUseAsRefs,
    onBatchRegen: handleBatchRegen,
    onBatchDelete: handleBatchDelete,
    hasSelection: markedIds.size > 0,
  }, (view === 'gallery' || showHelp) && !lightboxOpen);

  return (
    <div className="app-layout">
      <Sidebar
        collections={collections}
        activeCollection={activeCollection}
        starredOnly={starredOnly}
        showTrashed={showTrashed}
        showUncategorized={showUncategorized}
        onShowAll={handleShowAll}
        onShowStarred={handleShowStarred}
        onShowTrashed={handleShowTrashed}
        onShowUncategorized={handleShowUncategorized}
        onSelectCollection={handleSelectCollection}
        onCreateCollection={handleCreateCollection}
        onOpenDashboard={() => setView('dashboard')}
        onOpenSettings={() => setSettingsOpen(true)}
        pinned={sidebarPinned}
        onTogglePin={() => setSidebarPinned(!sidebarPinned)}
        todayCost={todayCost}
      />

      <main className="main-content">
        <header className="column-header main-header">
          <TagFilterBar
            filterTags={filterTags}
            onAddTag={addFilterTag}
            onRemoveTag={removeFilterTag}
            onClearTags={clearFilterTags}
            availableTags={tags}
            models={models}
            filterModel={filterModel}
            onSetModel={setFilterModel}
          />
          <select
            className="size-select"
            value={thumbnailSize}
            onChange={(e) => setThumbnailSize(e.target.value as typeof thumbnailSize)}
            title="Thumbnail size"
          >
            <option value="small">S</option>
            <option value="medium">M</option>
            <option value="large">L</option>
            <option value="xl">XL</option>
            <option value="xxl">XXL</option>
          </select>
          {generating && generateProgress && (
            <span className="batch-progress">
              {generateProgress.current}/{generateProgress.total}
            </span>
          )}
          <JobsIndicator
            jobs={jobs}
            activeCount={activeCount}
            failedJobs={failedJobs}
            failedCount={failedCount}
            onDismissFailedJob={dismissFailedJob}
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              setGenerateInitialState(undefined);
              setGenerateOpen(true);
            }}
          >
            Generate
          </button>
        </header>

        <Gallery
          generations={generations}
          selectedId={selectedId}
          markedIds={markedIds}
          thumbnailSize={thumbnailSize}
          onSelect={handleSelect}
          onDoubleClick={(id) => {
            setSelectedId(id);
            setLightboxOpen(true);
          }}
          onContextMenu={(generation, position) => {
            setContextMenu({ generation, position });
          }}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
      </main>

      {detailsOpen && selectedGeneration && (
        <Details
          generation={selectedGeneration}
          models={models}
          collections={collections}
          onClose={() => setDetailsOpen(false)}
          onToggleStar={handleToggleStar}
          onUpdateTitle={handleUpdateTitle}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onAddToCollection={async (collectionName) => {
            if (!selectedId) return;
            await api.addToCollection(selectedId, collectionName);
            refresh();
            refreshCollections();
          }}
          onRemoveFromCollection={async (collectionName) => {
            if (!selectedId) return;
            await api.removeFromCollection(selectedId, collectionName);
            refresh();
            refreshCollections();
          }}
          onFilterByTag={addFilterTag}
          onRemix={handleOpenRemix}
          onReference={handleOpenReference}
          onTrash={handleTrash}
          onOpenFullViewer={() => setLightboxOpen(true)}
        />
      )}

      {view === 'compare' && compareGenerations && (
        <Compare
          left={compareGenerations.left}
          right={compareGenerations.right}
          onClose={() => {
            setView('gallery');
            setCompareIds(null);
          }}
        />
      )}

      {view === 'dashboard' && (
        <Dashboard onClose={() => setView('gallery')} />
      )}

      {settingsOpen && (
        <Settings
          tags={allTags}
          hiddenTags={hiddenTags}
          onToggleHiddenTag={toggleHiddenTag}
          onClose={() => setSettingsOpen(false)}
          onSelfHostedChange={refreshSelfHostedStatus}
        />
      )}

      {showHelp && (
        <Cheatsheet onClose={() => setShowHelp(false)} />
      )}

      {contextMenu && (
        <ContextMenu
          generation={contextMenu.generation}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onToggleStar={() => handleContextMenuToggleStar(contextMenu.generation.id)}
          onTrash={() => handleContextMenuTrash(contextMenu.generation.id)}
        />
      )}

      {lightboxOpen && selectedGeneration && (
        <Lightbox
          generation={selectedGeneration}
          onClose={() => setLightboxOpen(false)}
          onNext={selectNext}
          onPrevious={selectPrevious}
          hasNext={hasNext}
          hasPrevious={hasPrevious}
        />
      )}

      {remixOpen && selectedGeneration && (
        <RemixModal
          generation={selectedGeneration}
          models={models}
          references={remixReferences}
          onClose={() => setRemixOpen(false)}
          onGenerate={handleRemixGenerate}
          onAddReference={() => setPickerOpen(true)}
          onRemoveReference={handleRemoveRemixReference}
        />
      )}

      {pickerOpen && (
        <GalleryPickerModal
          selectedRefIds={new Set(remixReferences.map((r) => r.id))}
          onSelect={handleAddReferenceFromPicker}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {generateOpen && (
        <GenerateModal
          models={models}
          initialState={generateInitialState}
          onClose={() => {
            setGenerateOpen(false);
            setGenerateInitialState(undefined);
          }}
          onGenerate={handleGenerate}
        />
      )}

      {markedIds.size > 0 && (
        <BatchActionBar
          count={markedIds.size}
          availableTags={tags}
          collections={collections}
          tagPopoverOpen={batchTagOpen}
          onTagPopoverOpenChange={setBatchTagOpen}
          onTag={handleBatchTag}
          onAddToCollection={async (collectionName) => {
            for (const id of markedIds) {
              await api.addToCollection(id, collectionName);
            }
            refreshCollections();
          }}
          onUseAsRefs={handleUseAsRefs}
          onRegen={handleBatchRegen}
          onCompare={handleCompare}
          onDelete={handleBatchDelete}
          onClear={handleClearSelection}
        />
      )}

      <style>{`
        .main-header {
          gap: var(--spacing-md);
        }
        .batch-progress {
          color: var(--accent);
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
        }
        .size-select {
          height: 36px;
          padding: 0 var(--spacing-md);
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
          font-weight: 500;
          cursor: pointer;
        }
        .size-select:hover {
          border-color: var(--border-light);
        }
        .size-select:focus {
          outline: none;
          border-color: var(--accent);
        }
      `}</style>
    </div>
  );
}
