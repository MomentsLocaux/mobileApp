import { CreateEventStepper } from '@/components/events/CreateEventStepper';
import { RequireCreateAccess } from '@/components/identity/RequireCreateAccess';

export default function CreateEventScreen() {
  return (
    <RequireCreateAccess>
      <CreateEventStepper />
    </RequireCreateAccess>
  );
}
