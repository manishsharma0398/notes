// example-08-close-callbacks.js
const net = require('net');

const server = net.createServer((socket) => {
  socket.on('close', () => {
    console.log('Socket closed');
  });

  socket.end();
});

server.listen(0, () => {
  const client = net.createConnection(server.address().port);
  client.on('close', () => {
    console.log('Client closed');
    server.close();
  });
});
