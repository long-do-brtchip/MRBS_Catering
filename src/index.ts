import {Cache} from "./cache";
import {CalendarManager, ITimelineEntry, ITimelineRequest} from "./calendar";
import {Database} from "./database";
import {HttpServer} from "./httpserver";
import {log} from "./log";
import {Persist} from "./persist";
import {PanLService} from "./service";
import {TcpSocket} from "./socket";

(async () => {
  const isProduction = (process.env.NODE_ENV === "production");
  const [service, stopCallback] = await PanLService.getInstance();
  const http = new HttpServer(service, isProduction ? 80 : 8080);
  process.on("SIGINT", async () => {
    log.verbose("Caught interrupt signal");
    await stopCallback();
    await http.stop();
    process.exit();
  });
})();
