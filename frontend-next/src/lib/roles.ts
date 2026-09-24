import type { RoleId } from "./api";

// Names match backend-python/app/roles.json
export const ROLES: { id: RoleId; name: string; blurb: string; hue: string }[] = [
  { id: "therapist", name: "Emotional Therapist", blurb: "Talk through what's on your mind", hue: "#7C6BB5" },
  { id: "health", name: "Health Assistant", blurb: "Diet, sleep and everyday wellbeing", hue: "#5E8F4E" },
  { id: "career", name: "Career Counsellor", blurb: "Plan your next move at work", hue: "#B7802A" },
  { id: "fitness", name: "Fitness Coach", blurb: "Training plans and recovery", hue: "#3A67C4" },
];

export const roleById = (id: string) => ROLES.find((r) => r.id === id) ?? ROLES[0];
