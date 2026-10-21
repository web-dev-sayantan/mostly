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

/** A null status means the check failed; do not trap the user in onboarding. */
export const needsOnboarding = (completed: boolean | null): boolean =>
  completed === false;

export const onboardingIsComplete = (
  signedIn: boolean,
  completed: boolean | null
): boolean => signedIn && completed === true;

/** iOS waits for install plus the first session before asking for push. */
export const shouldRequestPush = ({
  requested,
  platform,
  publicKey,
}: {
  requested: boolean;
  platform: "ios" | "android" | "desktop";
  publicKey: string | null | undefined;
}): boolean => requested && platform !== "ios" && Boolean(publicKey);
