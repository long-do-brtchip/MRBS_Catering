import {HttpServer} from "./httpserver";
import {log} from "./log";
import {PanLService} from "./service";

(async () => {
  await PanLService.getInstance();
  await HttpServer.getInstance();
})();
