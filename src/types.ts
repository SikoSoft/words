export type WordType = 'noun' | 'verb'

export type NounCategory =
  | 'abstract'
  | 'adult'
  | 'animals'
  | 'art'
  | 'body'
  | 'brainrot'
  | 'buildings'
  | 'clothing'
  | 'emotions'
  | 'famous'
  | 'food'
  | 'nature'
  | 'objects'
  | 'people'
  | 'places'
  | 'plants'
  | 'popculture'
  | 'space'
  | 'sports'
  | 'technology'
  | 'time'
  | 'tools'
  | 'water'
  | 'weather'

export type VerbCategory =
  | 'action'
  | 'adult'
  | 'communication'
  | 'creation'
  | 'destruction'
  | 'emotion'
  | 'mental'
  | 'movement'
  | 'social'

export type Category = NounCategory | VerbCategory

export interface Word {
  text: string
  type: WordType
  categories: Category[]
}
