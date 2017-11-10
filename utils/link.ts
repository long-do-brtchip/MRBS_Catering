import readline = require("readline");
import {Cache} from "../src/cache";
import {Persist} from "../src/persist";
import {PanLService} from "../src/service";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Room address:", (address) => {
  rl.question("Unconfigured ID:", async (id) => {
    const service = await PanLService.getInstance();
    const persist = await Persist.getInstance();
    const cache = await Cache.getInstance();

    const panl = await cache.getUnconfigured(Number(id));
    if (panl !== undefined) {
      const [path, uuid] = panl;
      if (await persist.findRoomUuid(address)) {
        persist.linkPanL(uuid, address);
        service.emit("uuid", path, uuid);
        rl.write("Saved to database");
      } else {
        rl.write("Invalid room address");
      }
    } else {
      rl.write("Invalid unconfigured PanL ID");
    }
    rl.close();
  });
});
