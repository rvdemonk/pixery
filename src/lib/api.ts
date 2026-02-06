import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import type {
  Generation,
  GenerateParams,
  ListFilter,
  TagCount,
  ModelInfo,
  CostSummary,
  Reference,
  Job,
  SelfHostedStatus,
  Collection,
} from './types';

export async function generateImage(params: GenerateParams): Promise<Generation> {
  return invoke('generate_image', { params });
}

export async function listGenerations(filter: ListFilter = {}): Promise<Generation[]> {
  return invoke('list_generations', { filter });
}

export async function searchGenerations(query: string, limit: number = 20): Promise<Generation[]> {
  return invoke('search_generations', { query, limit });
}

export async function getGeneration(id: number): Promise<Generation | null> {
  return invoke('get_generation', { id });
}

export async function toggleStarred(id: number): Promise<boolean> {
  return invoke('toggle_starred', { id });
}

export async function trashGeneration(id: number): Promise<boolean> {
  return invoke('trash_generation', { id });
}

export async function trashGenerations(ids: number[]): Promise<number> {
  return invoke('trash_generations', { ids });
}

export async function restoreGeneration(id: number): Promise<boolean> {
  return invoke('restore_generation', { id });
}

export async function permanentlyDeleteGeneration(id: number): Promise<boolean> {
  return invoke('permanently_delete_generation', { id });
}

export async function updatePrompt(id: number, prompt: string): Promise<void> {
  return invoke('update_prompt', { id, prompt });
}

export async function updateTitle(id: number, title: string | null): Promise<void> {
  return invoke('update_title', { id, title });
}

export async function addTags(id: number, tags: string[]): Promise<void> {
  return invoke('add_tags', { id, tags });
}

export async function removeTag(id: number, tag: string): Promise<void> {
  return invoke('remove_tag', { id, tag });
}

export async function listTags(): Promise<TagCount[]> {
  return invoke('list_tags');
}

export async function listModels(): Promise<ModelInfo[]> {
  return invoke('list_models');
}

export async function getCostSummary(since?: string): Promise<CostSummary> {
  return invoke('get_cost_summary', { since });
}

export async function getReferences(id: number): Promise<Reference[]> {
  return invoke('get_references', { id });
}

export function getImageUrl(path: string): string {
  // Use Tauri's convertFileSrc to load local files
  return convertFileSrc(path);
}

export async function listJobs(): Promise<Job[]> {
  return invoke('list_jobs');
}

export async function listFailedJobs(limit?: number): Promise<Job[]> {
  return invoke('list_failed_jobs', { limit });
}

// Self-hosted server settings

export async function getSelfhostedUrl(): Promise<string | null> {
  return invoke('get_selfhosted_url');
}

export async function setSelfhostedUrl(url: string | null): Promise<void> {
  return invoke('set_selfhosted_url', { url });
}

export async function checkSelfhostedHealth(): Promise<SelfHostedStatus> {
  return invoke('check_selfhosted_health');
}

// Prompt history

export async function promptHistory(limit: number): Promise<[number, string, string][]> {
  return invoke('prompt_history', { limit });
}

// Collections

export async function listCollections(): Promise<Collection[]> {
  return invoke('list_collections');
}

export async function createCollection(name: string, description?: string): Promise<Collection> {
  return invoke('create_collection', { name, description });
}

export async function addToCollection(generationId: number, collectionName: string): Promise<void> {
  return invoke('add_to_collection', { generationId, collectionName });
}
