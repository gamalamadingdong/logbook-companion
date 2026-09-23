import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button, Modal } from './ui';
import { deleteMyAccount } from '../services/accountDeletion';

const CONFIRMATION_PHRASE = 'DELETE';

interface DeleteAccountSectionProps {
  isCoach?: boolean;
}

/**
 * Account deletion, required by App Store Review guideline 5.1.1(v) for any app
 * that supports account creation.
 *
 * Deliberately explicit about what does and does not disappear. Team records a
 * coach created are kept for the squad with the coach's identity cleared, and
 * results already published to Concept2 live on Concept2's servers.
 */
export function DeleteAccountSection({ isCoach = false }: DeleteAccountSectionProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

  const confirmed = confirmation.trim().toUpperCase() === CONFIRMATION_PHRASE;

  const close = () => {
    if (deleting) return;
    setOpen(false);
    setConfirmation('');
  };

  const remove = async () => {
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteMyAccount();
      // The session is gone, so send the athlete somewhere that does not assume
      // an account and clear any cached application state with a full reload.
      window.location.assign('/login');
    } catch (error) {
      setDeleting(false);
      toast.error(error instanceof Error ? error.message : 'Could not delete the account.');
    }
  };

  return (
    <section className="rounded-xl border border-accent-danger/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-accent-danger-text">
        <AlertTriangle size={16} aria-hidden="true" />
        Delete account
      </h3>
      <p className="mt-2 text-sm text-content-secondary">
        Permanently deletes your account, workouts, training history and personal settings.
        This cannot be undone.
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3 min-h-11 border-accent-danger/50 text-accent-danger-text"
        onClick={() => setOpen(true)}
      >
        Delete account
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Delete your account?"
        description="This permanently removes your account and cannot be undone."
        placement="mobile-sheet"
        footer={(
          <>
            <Button type="button" variant="secondary" onClick={close} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="border-accent-danger/50 text-accent-danger-text"
              disabled={!confirmed || deleting}
              onClick={() => void remove()}
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </>
        )}
      >
        <div className="space-y-4 text-sm text-content-secondary">
          <div>
            <p className="font-medium text-content-primary">What is deleted</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Your profile, settings, goals and benchmarks</li>
              <li>Every workout you have logged and its analysis</li>
              <li>Your training blocks, assignments and team memberships</li>
              <li>Your Concept2 connection and its stored credentials</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-content-primary">What is kept</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {isCoach && (
                <li>
                  Team records you created, including sessions, erg scores and athlete notes.
                  They stay with the squad and are no longer attributed to you.
                </li>
              )}
              <li>
                Workouts already published to Concept2. Those live in your Concept2 logbook
                and must be removed there.
              </li>
            </ul>
          </div>

          <div>
            <label htmlFor="delete-confirmation" className="font-medium text-content-primary">
              Type {CONFIRMATION_PHRASE} to confirm
            </label>
            <input
              id="delete-confirmation"
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              autoComplete="off"
              className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface-secondary px-3 text-content-primary focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>
        </div>
      </Modal>
    </section>
  );
}
