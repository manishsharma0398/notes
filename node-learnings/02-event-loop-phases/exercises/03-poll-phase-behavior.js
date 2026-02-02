const http = require("node:http");

const server = http.createServer((req, res) => {
  console.log("Inside Server");
  res.end("Hello World");
  setTimeout(() => {
    console.log("I am inside setTimeout inside server");
  }, 0);

  setImmediate(() => {
    console.log("I am inside setImmediate inside server");
  });
});

// when server.listen is called, node.js internally calls process.nextTick(() => {
//   server.emit("listening");
// });
server.listen(3000, () => {
  console.log("Server is running on port 3000");
});

setTimeout(() => {
  console.log("I am inside setTimeout");
}, 0);

setImmediate(() => {
  console.log("I am inside setImmediate");
});