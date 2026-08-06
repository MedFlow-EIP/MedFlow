export type Screen = "home" | "path" | "lesson" | "progress";

export interface Path {
  id: string;
  title: string;
  description: string;
  progress: number;
  totalLessons: number;
  completedLessons: number;
  isLocked: boolean;
  color: string;
  emoji: string;
}

export interface Lesson {
  id: string;
  title: string;
  type: "lesson" | "review" | "test";
  status: "locked" | "available" | "completed";
  stars: number;
  position: "left" | "center" | "right";
}

export interface FlashCardData {
  question: string;
  answer: string;
  color: string;
}
