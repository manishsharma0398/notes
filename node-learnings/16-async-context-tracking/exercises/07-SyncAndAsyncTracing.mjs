import {
  AsyncLocalStorage,
  executionAsyncId,
  triggerAsyncId,
} from "node:async_hooks";
import { randomUUID } from "node:crypto";

const storage = new AsyncLocalStorage();

const calculatePrimes = (limit) => {
  for (let i = 0; i < limit; i++) {
    randomUUID();
  }
};

import fs from "node:fs";
const logger = (context) =>
  fs.writeSync(
    1,
    `Req: ${JSON.stringify(storage.getStore())} | Exec: ${executionAsyncId()} | Trigger: ${triggerAsyncId()} | ${context}\n`,
  );

const timerCallback = () => {
  logger("Before calculatePrimes inside timerCallback");
  calculatePrimes(100000);
  logger("After calculatePrimes inside timerCallback");
};

setTimeout(async () => {
  logger("Before calculatePrimes inside setTimeout");
  const promises = [];
  for (let i = 1; i <= 5; i++) {
    promises.push(
      new Promise((resolve) => {
        storage.run({ reqId: `${i}-${randomUUID()}` }, () => {
          logger("Before calculatePrimes inside promise");
          calculatePrimes(100000);
          logger("After calculatePrimes inside promise");
          setTimeout(() => {
            timerCallback();
            resolve();
          }, 50);
        });
      }),
    );
  }

  await Promise.all(promises).then(() => {
    logger("After all promises resolved");
  });
}, 0);
