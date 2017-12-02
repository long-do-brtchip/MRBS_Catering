import express = require("express");
import {Server} from "http";
import * as path from "path";
import {api} from "./api";
import {log} from "./log";
import {PanLService} from "./service";

export class HttpServer {
  private app: express.Application;
  private server: Server;

  public constructor(private srv: PanLService, private port: number) {
    this.app = express();
    this.app.locals.service = srv;
    this.app.use(express.urlencoded({extended: true}));
    this.app.use(express.json());
    this.app.use("/api", api);
    this.app.use(express.static("web/dist"));
    this.app.get("/", (req, res) => {
      res.sendFile(path.resolve("web/dist/index.html"));
    });

    this.server = this.app.listen(port, () => {
      log.info("Web server started on port " + port);
    });
  }

  public async stop() {
    await new Promise<void>((accept) => this.server.close(accept));
  }
}
