'use strict';
// "Is Areej actually at the Mac?" — awake, unlocked, and input within the last `idleSeconds`.
function createPresence(powerMonitor, idleSeconds = 300) {
  return {
    isPresent() {
      try { return powerMonitor.getSystemIdleState(idleSeconds) === 'active'; }
      catch { return true; }
    },
  };
}
module.exports = { createPresence };
