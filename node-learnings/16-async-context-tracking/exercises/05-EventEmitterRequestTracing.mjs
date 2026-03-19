import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import EventEmitter from "node:events";

const storage = new AsyncLocalStorage();
const event = new EventEmitter();

storage.run({ id: 1 }, () => {
  console.log(storage.getStore());

  event.on("data", () => {
    console.log("data: ", storage.getStore());
  });

  event.on(
    "bindData",
    AsyncResource.bind(() => {
      console.log("bindData: ", storage.getStore());
    }),
  );
});

event.emit("data");
event.emit("bindData");
