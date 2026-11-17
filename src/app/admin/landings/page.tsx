import { Landings } from './Landings'
import { LandingsWorkspaceGate } from './LandingsWorkspaceGate'

export default function LandingsPage() {
	return (
		<LandingsWorkspaceGate>
			<Landings />
		</LandingsWorkspaceGate>
	)
}
