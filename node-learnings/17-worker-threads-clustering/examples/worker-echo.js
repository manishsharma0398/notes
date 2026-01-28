// Worker thread that echoes back received data
// Used to measure message passing overhead

const { parentPort } = require('worker_threads');

parentPort.on('message', (msg) => {
  // Simply echo back the data (no processing)
  parentPort.postMessage({ data: msg.data });
});
