import { useState, useEffect, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Generation, ModelInfo, ListFilter } from './lib/types';
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
import { GenerateForm } from './components/GenerateForm';
import { Compare } from './components/Compare';
import { Dashboard } from './components/Dashboard';
import { Cheatsheet } from './components/Cheatsheet';
import { ContextMenu } from './components/ContextMenu';
import { Lightbox } from './components/Lightbox';
import { JobsIndicator } from './components/JobsIndicator';
import { RemixModal } from './components/RemixModal';
import { GalleryPickerModal } from './components/GalleryPickerModal';
import { Settings } from './components/Settings';
import type { Reference } from './lib/types';

type View = 'gallery' | 'compare' | 'dashboard';

export default function App() {
  // Filter state
  const [filter, setFilter] = useState<ListFilter>({ limit: 100 });
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [starredOnly, setStarredOnly] = useState(false);

  // Selection state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<[number, number] | null>(null);

  // UI state
  const [view, setView] = useState<View>('gallery');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
  const [models, setModels] = useState<ModelInfo[]>([]);

  // Hooks
  const { generations: allGenerations, loading, refresh, search } = useGenerations({ filter });
  const { tags: allTags, addTags, removeTag, refresh: refreshTags } = useTags();
  const { generating, error: generateError, generate } = useGenerate();
  const { jobs, activeCount } = useJobs();
  const { hiddenTags, toggleHiddenTag } = useSettings();

  // Filter out hidden tags
  const generations = useMemo(
    () => allGenerations.filter((g) => !g.tags.some((t) => hiddenTags.includes(t))),
    [allGenerations, hiddenTags]
  );
  const tags = useMemo(
    () => allTags.filter((t) => !hiddenTags.includes(t.name)),
    [allTags, hiddenTags]
  );

  // Load models on mount
  useEffect(() => {
    api.listModels().then(setModels);
  }, []);

  // Listen for new generations from CLI/external sources
  useEffect(() => {
    const unlisten = listen('generation-added', () => {
      refresh();
      refreshTags();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refresh, refreshTags]);

  // Update filter when tag/starred changes
  useEffect(() => {
    setFilter((prev) => ({
      ...prev,
      tag: selectedTag || undefined,
      starred_only: starredOnly,
    }));
  }, [selectedTag, starredOnly]);

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

  // Generate from remix modal
  const handleRemixGenerate = useCallback(async (prompt: string, model: string, referencePaths: string[]) => {
    if (!selectedGeneration) return;
    // Close modals immediately
    setRemixOpen(false);
    setPickerOpen(false);
    // Generate in background
    const result = await generate({
      prompt,
      model,
      tags: selectedGeneration.tags,
      reference_paths: referencePaths,
      copy_to: null,
    });
    if (result) {
      refresh();
      refreshTags();
      setSelectedId(result.id);
    }
  }, [selectedGeneration, generate, refresh, refreshTags]);

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

  const handleGenerate = useCallback(async (prompt: string, model: string, genTags: string[]) => {
    const result = await generate({
      prompt,
      model,
      tags: genTags,
      reference_paths: [],
      copy_to: null,
    });
    if (result) {
      refresh();
      refreshTags();
      setSelectedId(result.id);
      setGenerateOpen(false);
    }
  }, [generate, refresh, refreshTags]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query) {
      search(query);
    } else {
      refresh();
    }
  }, [search, refresh]);

  // Keyboard shortcuts
  useKeyboard({
    onNext: selectNext,
    onPrevious: selectPrevious,
    onToggleStar: handleToggleStar,
    onOpenDetails: () => selectedId && setDetailsOpen(true),
    onCompare: () => {
      // TODO: implement multi-select for compare
    },
    onRegenerate: handleOpenRemix,
    onFocusGenerate: () => setGenerateOpen(true),
    onFocusSearch: () => document.getElementById('search-input')?.focus(),
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
      } else if (detailsOpen) {
        setDetailsOpen(false);
      } else if (generateOpen) {
        setGenerateOpen(false);
      } else {
        setSelectedId(null);
      }
    },
    onDelete: handleTrash,
  }, (view === 'gallery' || showHelp) && !lightboxOpen);

  return (
    <div className="app-layout">
      <Sidebar
        tags={tags}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        starredOnly={starredOnly}
        onToggleStarred={() => setStarredOnly(!starredOnly)}
        onOpenDashboard={() => setView('dashboard')}
        onOpenSettings={() => setSettingsOpen(true)}
        pinned={sidebarPinned}
        onTogglePin={() => setSidebarPinned(!sidebarPinned)}
      />

      <main className="main-content">
        <header className="column-header main-header">
          <div className="search-bar">
            <input
              id="search-input"
              type="text"
              placeholder="Search prompts... (press /)"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <JobsIndicator jobs={jobs} activeCount={activeCount} />
          <button
            className="btn btn-primary"
            onClick={() => setGenerateOpen(!generateOpen)}
          >
            {generateOpen ? 'Close' : 'Generate'}
          </button>
        </header>

        {generateOpen && (
          <GenerateForm
            models={models}
            generating={generating}
            error={generateError}
            onGenerate={handleGenerate}
            onCollapse={() => setGenerateOpen(false)}
          />
        )}

        <Gallery
          generations={generations}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setDetailsOpen(true);
          }}
          onDoubleClick={(id) => {
            setSelectedId(id);
            setLightboxOpen(true);
          }}
          onContextMenu={(generation, position) => {
            setContextMenu({ generation, position });
          }}
          loading={loading}
        />
      </main>

      {detailsOpen && selectedGeneration && (
        <Details
          generation={selectedGeneration}
          models={models}
          onClose={() => setDetailsOpen(false)}
          onToggleStar={handleToggleStar}
          onUpdateTitle={handleUpdateTitle}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onRemix={handleOpenRemix}
          onTrash={handleTrash}
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

      <style>{`
        .main-header {
          gap: var(--spacing-md);
        }
        .search-bar {
          flex: 1;
        }
        .search-bar input {
          width: 100%;
          max-width: 400px;
        }
      `}</style>
    </div>
  );
}
