import connect from "./reassigned.cjs";
console.log("connect('db://x') :", connect("db://x"));
console.log("connect.version   :", connect.version);
import * as ns from "./reassigned.cjs";
console.log("namespace keys    :", Object.keys(ns));
