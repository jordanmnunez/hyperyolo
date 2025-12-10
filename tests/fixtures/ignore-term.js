// Keeps running and ignores SIGTERM so the executor must escalate to SIGKILL.
process.on('SIGTERM', () => {});

setInterval(() => {
  // Busy loop to keep the event loop alive.
}, 250);
