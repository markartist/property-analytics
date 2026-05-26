# Agent Identity And Charter Model

Date: 05/10/2026

## Agent Identity

`AgentIdentity` defines the operational identity of a named steward:

- `agent_id`
- `agent_type`: captain, commodore, fleet, expert_lane, scribe
- `display_name`
- `formal_title`
- assigned property, region, or lane
- active/retired status
- version

Names are operational labels. They do not imply personhood or uncontrolled autonomy.

## Agent Charter

`AgentCharter` defines boundaries:

- Sphere of Responsibility
- Sphere of Knowledge
- Sphere of Action
- Sphere of Memory
- visibility scope
- allowed actions
- blocked actions
- allowed/blocked memory classes
- authority boundaries
- care obligations
- escalation obligations
- steward roles
- approval status

Charters reject unbounded authority. `allowed_actions: ["*"]` is not permitted. Blocked actions and care obligations are required.

## Default Captain Boundary

Captains may own property-level awareness, self notes, watch posture, commitments, and Captain Read preparation. Captains may not publish official artifacts, mutate Data Pond truth, promote memory to canonical fact, bypass Quartermaster, or bypass Fleet Scribe.
