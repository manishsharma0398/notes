```
console.log(x);
var x = 5;
console.log(x);
```
Line 1 output: undefined
Line 3 output: 5
Reason: At line 1 var x is hoisted. on line 2 x is assigned a value = 5. At line 3, we log the value which is now 5

```
console.log(typeof y);
let y = 10;
```
Output: Reference Error: y is not defined
Error or not? Error
Reason: y is not hoisted but in TDZ

```
foo();
bar();

function foo() { console.log("foo"); }
var bar = function() { console.log("bar"); };
```
foo() output: foo
bar() output or error: error
Reason: var bar is hoisted as undefined 

```
var x = "global";
function test() {
  console.log(x);
  var x = "local";
  console.log(x);
}
test();
```
First console.log: undefined
Second console.log: local
Reason: inside test function x is hoisted causing variable shadowing with global x variable. 

```
function outer() {
  var secret = "42";
  return function inner() {
    return secret;
  };
}

var secret = "0";
var getSecret = outer();
console.log(getSecret());
```
Output: 42
Reason (use "lexical scope" in your answer): inner function forms a closure and closure has access to its and its parents lexical scope, thus instead of 0 we get 42 as answer

```
function getValue() {
  return
    42;
}
console.log(getValue());
```
Output: undefined
Reason: after return there is a new line 

```
let i = 5;
{
  console.log(i);
  let i = 10;
}
```
Output or error: error
Reason: let variable assignment is not hoisted but TDZ

```
function a() { b(); }
function b() { c(); }
function c() { console.trace(); }
a();
```
What does console.trace() print? Describe the call stack order. global EC, a EC, b EC, c EC
Reason: multiple EC formed as calling function from another function
