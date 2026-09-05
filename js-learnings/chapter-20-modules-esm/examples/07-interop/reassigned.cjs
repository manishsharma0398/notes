// the shape CJS libraries actually ship: a single function, replacing module.exports
module.exports = function connect(url) { return `connected to ${url}`; };
module.exports.version = "1.4.0";
