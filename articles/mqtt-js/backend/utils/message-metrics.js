function recordTimestamp(state, now, windowMs) {
  state.messageTimestamps.push(now);
  pruneOldTimestamps(state, now, windowMs);
}

function pruneOldTimestamps(state, now, windowMs) {
  while (state.messageTimestamps.length > 0 && now - state.messageTimestamps[0] > windowMs) {
    state.messageTimestamps.shift();
  }
}

function calculateRate(state, windowMs, now = Date.now()) {
  pruneOldTimestamps(state, now, windowMs);
  if (windowMs <= 0) {
    return 0;
  }
  const windowSeconds = windowMs / 1000;
  return state.messageTimestamps.length === 0 ? 0 : state.messageTimestamps.length / windowSeconds;
}

module.exports = { recordTimestamp, pruneOldTimestamps, calculateRate };
