import express = require("express");
import {Server} from "http";
import * as path from "path";
import {api} from "./api";
import {log} from "./log";

export class HttpServer {
  public static getInstance(): HttpServer {
    if (HttpServer.instance) {
      HttpServer.instance.addRef();
    } else {
      HttpServer.instance = new HttpServer(
        process.env.NODE_ENV === "production" ? 80 : 8080);
    }
    return HttpServer.instance;
  }

  private static instance: HttpServer | undefined;
  private app: express.Application;
  private server: Server;

  private constructor(private port: number, private refCnt = 1) {
    this.app = express();
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

  public stop(): void {
    if (--this.refCnt === 0) {
      this.server.close();
      HttpServer.instance = undefined;
    }
  }

  private addRef(): void {
    this.refCnt++;
  }
}
