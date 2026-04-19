
import { VoiceOption } from './types';

export const VOICES: VoiceOption[] = [
  // Female Voices
  { id: 'v1', name: 'Sophia', gender: 'female', baseVoice: 'Kore', description: 'Clear and professional' },
  { id: 'v2', name: 'Emma', gender: 'female', baseVoice: 'Kore', description: 'Warm and friendly' },
  { id: 'v3', name: 'Olivia', gender: 'female', baseVoice: 'Kore', description: 'Energetic and bright' },
  { id: 'v4', name: 'Isabella', gender: 'female', baseVoice: 'Zephyr', description: 'Calm and soothing' },
  { id: 'v5', name: 'Mia', gender: 'female', baseVoice: 'Zephyr', description: 'Soft and gentle' },
  { id: 'v6', name: 'Ava', gender: 'female', baseVoice: 'Zephyr', description: 'Young and cheerful' },
  { id: 'v7', name: 'Luna', gender: 'female', baseVoice: 'Kore', description: 'Mysterious and deep' },
  { id: 'v8', name: 'Stella', gender: 'female', baseVoice: 'Kore', description: 'Confident and sharp' },
  { id: 'v9', name: 'Chloe', gender: 'female', baseVoice: 'Zephyr', description: 'Casual and upbeat' },
  { id: 'v10', name: 'Aria', gender: 'female', baseVoice: 'Zephyr', description: 'Melodic and expressive' },
  { id: 'v11', name: 'Zoe', gender: 'female', baseVoice: 'Kore', description: 'Smart and helpful' },
  { id: 'v12', name: 'Nora', gender: 'female', baseVoice: 'Kore', description: 'Wise and steady' },
  { id: 'v13', name: 'Lily', gender: 'female', baseVoice: 'Zephyr', description: 'Kind and patient' },
  { id: 'v14', name: 'Grace', gender: 'female', baseVoice: 'Zephyr', description: 'Elegant and smooth' },
  { id: 'v15', name: 'Mila', gender: 'female', baseVoice: 'Kore', description: 'Playful and fast' },
  { id: 'v_story_f', name: 'Elena (Storyteller)', gender: 'female', baseVoice: 'Zephyr', description: 'Expressive and narrative' },
  { id: 'v_finance_f', name: 'Sarah (Financial)', gender: 'female', baseVoice: 'Kore', description: 'Empathetic, crisp, and reassuring' },

  // Male Voices
  { id: 'v16', name: 'Liam', gender: 'male', baseVoice: 'Puck', description: 'Standard and neutral' },
  { id: 'v17', name: 'Noah', gender: 'male', baseVoice: 'Puck', description: 'Strong and direct' },
  { id: 'v18', name: 'Oliver', gender: 'male', baseVoice: 'Puck', description: 'Academic and precise' },
  { id: 'v19', name: 'James', gender: 'male', baseVoice: 'Charon', description: 'Deep and resonant' },
  { id: 'v20', name: 'William', gender: 'male', baseVoice: 'Charon', description: 'Authoritative and bold' },
  { id: 'v21', name: 'Benjamin', gender: 'male', baseVoice: 'Charon', description: 'Rich and narrative' },
  { id: 'v22', name: 'Lucas', gender: 'male', baseVoice: 'Fenrir', description: 'Rugged and gritty' },
  { id: 'v23', name: 'Henry', gender: 'male', baseVoice: 'Fenrir', description: 'Classic and formal' },
  { id: 'v24', name: 'Theodore', gender: 'male', baseVoice: 'Fenrir', description: 'Elderly and wise' },
  { id: 'v25', name: 'Jack', gender: 'male', baseVoice: 'Puck', description: 'Friendly and boyish' },
  { id: 'v26', name: 'Leo', gender: 'male', baseVoice: 'Puck', description: 'Modern and fast' },
  { id: 'v27', name: 'Felix', gender: 'male', baseVoice: 'Charon', description: 'Serious and intense' },
  { id: 'v28', name: 'Sebastian', gender: 'male', baseVoice: 'Charon', description: 'Sophisticated' },
  { id: 'v29', name: 'Arthur', gender: 'male', baseVoice: 'Fenrir', description: 'Calm and steady' },
  { id: 'v30', name: 'Jasper', gender: 'male', baseVoice: 'Fenrir', description: 'Exciting and narrator-like' },
  { id: 'v_story_m', name: 'David (Storyteller)', gender: 'male', baseVoice: 'Charon', description: 'Deep, rich narrative' },
  { id: 'v_finance_m', name: 'Marcus (Financial)', gender: 'male', baseVoice: 'Charon', description: 'Steady, professional, and unhurried' },
];

export const EMOTIONS = [
  'Neutral',
  'Happy',
  'Sad',
  'Excited',
  'Calm',
  'Angry',
  'Whispering',
  'Shouting',
  'Inquisitive',
  'Terrified',
  'Sarcastic'
];

export const LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'ja-JP', name: 'Japanese' },
];
