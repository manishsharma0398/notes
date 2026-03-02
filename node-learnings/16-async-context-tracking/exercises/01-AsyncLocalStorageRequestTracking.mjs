import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const PORT = 8000;
const storage = new AsyncLocalStorage();

class RequestTracer {
  constructor(userId) {
    this.userId = userId;
    this.reqId = randomUUID();
    this.time = new Date().toISOString();
  }

  createContext(cb) {
    return storage.run(
      {
        userId: this.userId,
        reqId: this.reqId,
        time: this.time,
      },
      cb,
    );
  }

  static getContext() {
    return storage.getStore();
  }
}

const logger = (context) => {
  const store = RequestTracer.getContext();
  const reqId = store?.reqId ?? "no-req";
  const userId = store?.userId ?? "";
  console.log(`[${new Date().toISOString()}] [${reqId}] ${userId}`, context);
};

const delayExecution = () => {
  setTimeout(() => {
    Promise.resolve().then(() => {
      logger("Inside nested microtask");
    });
  }, 1000);
};

const reqHandler = async (req, res) => {
  logger("Inside reqHandler");
  delayExecution();
  logger("Finishing reqHandler");
  return res.end("Req lifecycle is over");
};

const server = createServer((req, res) => {
  const requestTracer = new RequestTracer(randomUUID());
  return requestTracer.createContext(() => reqHandler(req, res));
});

server.listen(PORT, () => console.log(`server running on PORT ${PORT}`));
