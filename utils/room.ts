import readline = require("readline");
import {log} from "../src/log";
import {IRoom, Persist} from "../src/persist";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Room address:", (address) => {
  rl.question("Room name:", (name) => {
    Persist.getInstance().then((persist) => {
      persist.addRoom({address, name}).then(() => {
        persist.stop();
        rl.write("Saved to database");
        rl.close();
      });
    });
  });
});
