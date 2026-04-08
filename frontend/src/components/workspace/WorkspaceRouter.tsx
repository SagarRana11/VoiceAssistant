import { useLayoutStore } from '../../store/useLayoutStore';
import { TalkWorkspace } from './TalkWorkspace';
import { ExerciseWorkspace } from './ExerciseWorkspace';
import { WellBeingWorkspace } from './WellBeingWorkspace';
import { MeditationWorkspace } from './MeditationWorkspace';
import { DietWorkspace } from './DietWorkspace';
import { ProfileWorkspace } from './ProfileWorkspace';
import { SettingsWorkspace } from './SettingsWorkspace';

/**
 * Renders the correct workspace based on the active feature in useLayoutStore.
 * Transition animation is handled by the parent workspace container via CSS.
 */
export function WorkspaceRouter() {
  const { activeFeature } = useLayoutStore();

  switch (activeFeature) {
    case 'talk':       return <TalkWorkspace />;
    case 'exercise':   return <ExerciseWorkspace />;
    case 'wellbeing':  return <WellBeingWorkspace />;
    case 'meditation': return <MeditationWorkspace />;
    case 'diet':       return <DietWorkspace />;
    case 'profile':    return <ProfileWorkspace />;
    case 'settings':   return <SettingsWorkspace />;
    default:           return <TalkWorkspace />;
  }
}
