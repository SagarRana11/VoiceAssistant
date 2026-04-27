import { useHospitalStore } from '../../store/hospitalStore';
import { EnrollPage }       from './EnrollPage';
import { HospitalHomePage } from './HospitalHomePage';

export function HospitalPage() {
  const { patient } = useHospitalStore();
  return patient ? <HospitalHomePage /> : <EnrollPage />;
}
