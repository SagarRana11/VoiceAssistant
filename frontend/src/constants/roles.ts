import { Role, RoleId } from '../types';

export const ROLES: Record<RoleId, Role> = {
  therapist: {
    id: 'therapist',
    name: 'Emotional Therapist',
    icon: '🧠',
    description: 'Empathetic support & emotional guidance',
    tone: 'Calm, empathetic, reflective',
    color: '#a855f7',
  },
  health: {
    id: 'health',
    name: 'Health Assistant',
    icon: '🏥',
    description: 'Symptom guidance & wellness advice',
    tone: 'Clinical but friendly',
    color: '#22c55e',
  },
  career: {
    id: 'career',
    name: 'Career Counsellor',
    icon: '💼',
    description: 'Strategic career guidance & growth plans',
    tone: 'Motivating and practical',
    color: '#f59e0b',
  },
  fitness: {
    id: 'fitness',
    name: 'Fitness Coach',
    icon: '💪',
    description: 'Workout plans & healthy habits',
    tone: 'Energetic and disciplined',
    color: '#ef4444',
  },
};

export const ROLE_LIST: Role[] = Object.values(ROLES);
export const DEFAULT_ROLE: RoleId = 'therapist';
