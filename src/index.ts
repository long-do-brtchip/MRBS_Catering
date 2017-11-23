import {HttpServer} from "./httpserver";
import {log} from "./log";
import {PanLService} from "./service";

(async () => {
  const srv = await PanLService.getInstance();
  const http = await HttpServer.getInstance();
  process.on("SIGINT", async () => {
    log.verbose("Caught interrupt signal");
    await http.stop();
    await srv.stop();
    process.exit();
  });
})();
