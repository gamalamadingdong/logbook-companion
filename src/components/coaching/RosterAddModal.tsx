import { useState } from 'react';
import type { CoachingAthlete, UserTeamInfo } from '../../services/coaching/types';
import type { MeasurementUnits } from '../../utils/unitConversion';
import { Button, Modal, Select } from '../ui';
import { AthleteEditorModal } from './AthleteEditorModal';
import { BulkRosterModal } from './BulkRosterModal';

interface Props {
  mode: 'single' | 'bulk';
  teams: UserTeamInfo[];
  initialTeamId: string | null;
  userId: string;
  units: MeasurementUnits;
  squads: string[];
  onSave: (teamId: string, data: Partial<CoachingAthlete> & { squad?: string }) => Promise<void>;
  onSaved: (count: number) => void;
  onClose: () => void;
}

/** Fix the destination before opening a form; All Teams never supplies an implicit team. */
export function RosterAddModal({ mode, teams, initialTeamId, userId, units, squads, onSave, onSaved, onClose }: Props) {
  const [teamId, setTeamId] = useState(initialTeamId ?? '');
  const [confirmed, setConfirmed] = useState(Boolean(initialTeamId && teams.some(t => t.team_id === initialTeamId)));
  const destination = teams.find(t => t.team_id === teamId);
  const destinationLabel = destination
    ? [destination.org_name, destination.team_name].filter(Boolean).join(' · ')
    : '';

  if (!confirmed || !destination) {
    return <Modal open onClose={onClose} title={mode === 'bulk' ? 'Add athletes to a team' : 'Add athlete to a team'}
      description="Choose which team's roster to add to. Your All Teams view will stay selected." size="sm">
      <div className="space-y-4">
        <Select label="Destination team" id="roster-destination" className="min-h-11" value={teamId} onChange={e => setTeamId(e.target.value)}>
          <option value="">Choose a team</option>
          {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
        </Select>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="min-h-11" onClick={onClose}>Cancel</Button>
          <Button variant="coaching" className="min-h-11" disabled={!destination} onClick={() => setConfirmed(true)}>Continue</Button>
        </div>
      </div>
    </Modal>;
  }

  return mode === 'bulk'
    ? <BulkRosterModal teamId={destination.team_id} destinationLabel={destinationLabel} userId={userId}
      existingSquads={squads} onClose={onClose} onSaved={onSaved} />
    : <AthleteEditorModal athlete={null} destinationLabel={destinationLabel} squads={squads} units={units}
      onSave={data => onSave(destination.team_id, data)} onCancel={onClose} />;
}
