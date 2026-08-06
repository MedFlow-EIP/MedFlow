export interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  photoURL: string;
  displayName: string;
  notifications: boolean;
  darkMode: boolean;
  createdAt?: any;
  updatedAt?: any;
  role?: string;
}

export interface Course {
  id: string;
  nom: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  createdAt: any;
  userId: string;
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface QuizQuestion {
  question: string;
  options: Record<string, string>;
  correct: string;
}