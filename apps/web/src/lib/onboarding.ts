export const TODAY_HINT_KEY = "mostly:today-hint";

export interface StarterGoal {
  name: string;
  emoji: string;
}

export const STARTER_GOALS: StarterGoal[] = [
  { name: "Reading", emoji: "📖" },
  { name: "Guitar", emoji: "🎸" },
  { name: "Singing", emoji: "🎤" },
  { name: "Coding", emoji: "💻" },
  { name: "Exercise", emoji: "🏃" },
  { name: "Meditation", emoji: "🧘" },
  { name: "Journaling", emoji: "✍️" },
  { name: "Language", emoji: "🌱" },
];

export const TODAY_HINT_COPY =
  "Tap a goal when you've done it. Details are optional.";

export const REMINDER_PERMISSION_COPY =
  "One reminder a day. No streak guilt, no spam.";
