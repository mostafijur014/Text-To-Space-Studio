
import Dexie, { Table } from 'dexie';
import { GenerationSettings } from './types';

export interface SavedAudio {
  id?: number;
  uid: string; // Unique string identifier
  name: string;
  blob: Blob;
  createdAt: number;
  settings: GenerationSettings;
  duration?: number;
}

export class MyDatabase extends Dexie {
  savedAudios!: Table<SavedAudio>;

  constructor() {
    super('TTSStudioDB');
    this.version(1).stores({
      savedAudios: '++id, uid, name, createdAt'
    });
  }
}

export const db = new MyDatabase();
