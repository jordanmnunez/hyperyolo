// Responds to SIGTERM by exiting shortly after to simulate graceful shutdown.
process.on('SIGTERM', () => {
  setTimeout(() => {
    process.exit(0);
  }, 50);
});

setInterval(() => {
  // Keep alive until signaled.
}, 250);
