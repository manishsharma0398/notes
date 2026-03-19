const fs = require("fs");
const zlib = require("zlib");
const { pipeline } = require("stream");

const readableStream = fs.createReadStream("non-existent-file.txt");
const gz = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });
const writeableStream = fs.createWriteStream("output.gz");

pipeline(readableStream, gz, writeableStream, (err) => {
  if (err) {
    console.error("error: ", err);
    console.log("writeableStream destroyed?", writeableStream.destroyed);
    console.log("gz destroyed?", gz.destroyed);
    console.log("readableStream destroyed?", readableStream.destroyed);
  } else console.log("Pipeline succeeded");
});
