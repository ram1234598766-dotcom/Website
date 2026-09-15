import { createProtocolState, getSyncStatus } from '../sync/protocol';

const state = createProtocolState('local', 'local');

export function getPeers() {
  return getSyncStatus(state).peers.filter((p) => p.online);
}
