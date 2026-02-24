const fs = require("fs");
const zlib = require("zlib");

const readableStream = fs.createReadStream("non-existent-file.txt");
const gz = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });
const writeableStream = fs.createWriteStream("output.gz");

readableStream.pipe(gz).pipe(writeableStream);

readableStream.on("error", (err) => {
  console.error("Readable stream error: ", err);
  console.log("readableStream destroyed?", readableStream.destroyed);
  console.log("gz destroyed?", gz.destroyed);
  console.log("writeableStream destroyed?", writeableStream.destroyed);
});

gz.on("error", (err) => {
  console.error("gz error: ", err);
  console.log("readableStream destroyed?", readableStream.destroyed);
  console.log("gz destroyed?", gz.destroyed);
  console.log("writeableStream destroyed?", writeableStream.destroyed);
});

writeableStream.on("error", (err) => {
  console.error("writeableStream error: ", err);
  console.log("writeableStream destroyed?", writeableStream.destroyed);
  console.log("readableStream destroyed?", readableStream.destroyed);
  console.log("gz destroyed?", gz.destroyed);
});
