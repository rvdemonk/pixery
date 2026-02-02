import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pixery-settings';

interface Settings {
  hiddenTags: string[];
}

const defaultSettings: Settings = {
  hiddenTags: [],
};

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return defaultSettings;
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // Persist on change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const toggleHiddenTag = useCallback((tag: string) => {
    setSettings((prev) => {
      const isHidden = prev.hiddenTags.includes(tag);
      return {
        ...prev,
        hiddenTags: isHidden
          ? prev.hiddenTags.filter((t) => t !== tag)
          : [...prev.hiddenTags, tag],
      };
    });
  }, []);

  const isTagHidden = useCallback(
    (tag: string) => settings.hiddenTags.includes(tag),
    [settings.hiddenTags]
  );

  return {
    settings,
    hiddenTags: settings.hiddenTags,
    toggleHiddenTag,
    isTagHidden,
  };
}
