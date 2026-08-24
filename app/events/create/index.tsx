import { CreateEventStepper } from '@/components/events/CreateEventStepper';
import { RequireEventFormAccess } from '@/components/identity/RequireEventFormAccess';

export default function CreateEventScreen() {
  return (
    <RequireEventFormAccess>
      <CreateEventStepper />
    </RequireEventFormAccess>
  );
}
