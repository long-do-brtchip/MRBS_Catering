import readline = require("readline");
import {Cache} from "../src/cache";
import {log} from "../src/log";
import {IRoom, Persist} from "../src/persist";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Room address:", (address) => {
  rl.question("Unconfigured ID:", async (id) => {
    const persist = await Persist.getInstance();
    const cache = await Cache.getInstance();
    const [path, uuid] = await cache.getUnconfigured(Number(id));
    if (path !== null && uuid !== null) {
      const room = await persist.findRoom(uuid);
      if (room) {
        await Promise.all([
          persist.linkPanL(uuid, address),
          cache.addConfigured(path, room),
        ]);
        rl.write("Saved to database");
      } else {
        rl.write("Invalid room address");
      }
    } else {
      rl.write("Invalid unconfigured ID");
    }
    persist.stop();
    cache.stop();
    rl.close();
  });
});
