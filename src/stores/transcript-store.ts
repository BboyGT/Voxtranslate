import { create } from 'zustand';

export interface TranscriptEntry {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: Date;
  isFinal: boolean;
  isTranslating: boolean;
}

interface TranscriptStore {
  entries: TranscriptEntry[];
  setEntries: (entries: TranscriptEntry[] | ((prev: TranscriptEntry[]) => TranscriptEntry[])) => void;
  addEntry: (entry: TranscriptEntry) => void;
  updateEntry: (id: string, updates: Partial<TranscriptEntry>) => void;
  clearEntries: () => void;
}

export const useTranscriptStore = create<TranscriptStore>((set) => ({
  entries: [],

  setEntries: (updater) =>
    set((state) => ({
      entries: typeof updater === 'function' ? updater(state.entries) : updater,
    })),

  addEntry: (entry) =>
    set((state) => ({ entries: [...state.entries, entry] })),

  updateEntry: (id, updates) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      ),
    })),

  clearEntries: () => set({ entries: [] }),
}));
