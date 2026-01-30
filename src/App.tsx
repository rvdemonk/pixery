import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Generation, ModelInfo, ListFilter } from './lib/types';
import * as api from './lib/api';
import { useGenerations } from './hooks/useGenerations';
import { useTags } from './hooks/useTags';
import { useKeyboard } from './hooks/useKeyboard';
import { useGenerate } from './hooks/useGenerate';
import { Sidebar } from './components/Sidebar';
import { Gallery } from './components/Gallery';
import { Details } from './components/Details';
import { GenerateForm } from './components/GenerateForm';
import { Compare } from './components/Compare';
import { Dashboard } from './components/Dashboard';
import { Cheatsheet } from './components/Cheatsheet';

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

  // Models
  const [models, setModels] = useState<ModelInfo[]>([]);

  // Hooks
  const { generations, loading, refresh, search } = useGenerations({ filter });
  const { tags, addTags, removeTag, refresh: refreshTags } = useTags();
  const { generating, error: generateError, generate } = useGenerate();

  // Load models on mount
  useEffect(() => {
    api.listModels().then(setModels);
  }, []);

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
  const selectNext = useCallback(() => {
    if (generations.length === 0) return;
    const currentIndex = selectedId
      ? generations.findIndex((g) => g.id === selectedId)
      : -1;
    const nextIndex = Math.min(currentIndex + 1, generations.length - 1);
    setSelectedId(generations[nextIndex].id);
  }, [generations, selectedId]);

  const selectPrevious = useCallback(() => {
    if (generations.length === 0) return;
    const currentIndex = selectedId
      ? generations.findIndex((g) => g.id === selectedId)
      : generations.length;
    const prevIndex = Math.max(currentIndex - 1, 0);
    setSelectedId(generations[prevIndex].id);
  }, [generations, selectedId]);

  // Actions
  const handleToggleStar = useCallback(async () => {
    if (!selectedId) return;
    await api.toggleStarred(selectedId);
    refresh();
  }, [selectedId, refresh]);

  const handleUpdatePrompt = useCallback(async (prompt: string) => {
    if (!selectedId) return;
    await api.updatePrompt(selectedId, prompt);
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

  const handleRegenerate = useCallback(async (model: string) => {
    if (!selectedGeneration) return;
    const result = await generate({
      prompt: selectedGeneration.prompt,
      model,
      tags: selectedGeneration.tags,
      reference_paths: [],
      copy_to: null,
    });
    if (result) {
      refresh();
      refreshTags();
      setSelectedId(result.id);
    }
  }, [selectedGeneration, generate, refresh, refreshTags]);

  const handleTrash = useCallback(async () => {
    if (!selectedId) return;
    await api.trashGeneration(selectedId);
    setSelectedId(null);
    setDetailsOpen(false);
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
    onRegenerate: () => selectedGeneration && handleRegenerate(selectedGeneration.model),
    onFocusGenerate: () => setGenerateOpen(true),
    onFocusSearch: () => document.getElementById('search-input')?.focus(),
    onShowHelp: () => setShowHelp(true),
    onEscape: () => {
      if (showHelp) {
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
  }, view === 'gallery' || showHelp);

  return (
    <div className="app-layout">
      <Sidebar
        tags={tags}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        starredOnly={starredOnly}
        onToggleStarred={() => setStarredOnly(!starredOnly)}
        onOpenDashboard={() => setView('dashboard')}
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
          loading={loading}
        />
      </main>

      {detailsOpen && selectedGeneration && (
        <Details
          generation={selectedGeneration}
          models={models}
          onClose={() => setDetailsOpen(false)}
          onToggleStar={handleToggleStar}
          onUpdatePrompt={handleUpdatePrompt}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onRegenerate={handleRegenerate}
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

      {showHelp && (
        <Cheatsheet onClose={() => setShowHelp(false)} />
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
