1. What does depth in your tracer correspond to in the JS engine's actual call stack?

- Answer: It corresponds to count of stack for Function's execution context

2. Your tracer tracks function boundaries. The engine tracks EC boundaries. What cases would make your tracer's depth disagree with the engine's actual call stack depth?

- Answer: 1. async functions, 2. if forgot to wrap the function

3. Why can't you track _block scope boundaries_ with `wrap`? What would you need instead?

- Answer: we would need AST, currently wrap only tracks depth for function call
