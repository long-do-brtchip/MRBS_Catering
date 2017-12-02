import {EventEmitter} from "events";
import net = require("net");
import {MessageBuilder} from "./builder";
import {Database} from "./database";
import {IAgentEvent, ICalendarEvent,
  IMessageTransport, IPanLEvent} from "./interface";
import {log} from "./log";
import {PanLPath} from "./path";
import {Persist} from "./persist";
import {MessageParser} from "./recv";

export class TcpSocket implements IMessageTransport {
  public static getTotalLength(payloads: Buffer[]): number {
      let total = 0;

      for (const payload of payloads) {
          total += payload.length;
      }
      return total;
  }

  private sockets: Map<number, net.Socket> = new Map();
  private evt: EventEmitter = new EventEmitter();

  constructor(private port: number) {
  }

  public async start(agentEvt: IAgentEvent, panlEvt: IPanLEvent) {
    const server = net.createServer((socket) => {
      this.clientHandler(socket, agentEvt, panlEvt);
    });

    server.listen(this.port, () => {
      this.evt.on("stop", () => {
        for (const [id, socket] of this.sockets) {
          log.info(`Closing socket for agent ${id}...`);
          const s = socket as any;
          if (s.parser) {
            s.parser.stop();
          }
          socket.end();
        }
        this.sockets.clear();
        log.silly("Close socket server");
        server.close(() => this.evt.emit("stopped"));
      });
      log.info(`PanLController listen on port ${this.port}`);
    });
  }

  public async stop() {
    await new Promise<void>((accept) => {
      this.evt.on("stopped", accept);
      this.evt.emit("stop");
    });
  }

  public onGlobalBroadcast(payloads: Buffer[]): void {
    const hdr = MessageBuilder.buildBroadcastTarget(
      TcpSocket.getTotalLength(payloads));

    for (const [id, socket] of this.sockets) {
        socket.write(hdr);
        for (const payload of payloads) {
            socket.write(payload);
        }
    }
  }

  public onSend(path: PanLPath, payloads: Buffer[]): void {
    /* Build messages, find routing, send */
    const hdr = MessageBuilder.buildTarget(path.dest,
      TcpSocket.getTotalLength(payloads));
    const socket = this.sockets.get(path.agent);

    if (socket === undefined) {
      // TODO: should log the error instead of throw exception
      throw(new Error(`Unknown agent id ${path.agent}`));
    }
    socket.write(hdr);
    for (const payload of payloads) {
      log.silly(`Write ${payload.toString("hex")} to ${path}`);
      socket.write(payload);
    }
  }

  private clientHandler(socket: net.Socket,
                        agentEvt: IAgentEvent, panlEvt: IPanLEvent) {
    const s = socket as any;

    socket.on("data", (data) => {
      if (s.parser) {
        log.silly(`Received ${data.byteLength} bytes from Agent` +
          `${s.parser.id}: ${data.toString("hex")}`);
        s.parser.onData(data);
      } else {
        MessageParser.parseAgentID(data).then(async (buf) => {
          Persist.getAgentId(buf).then((id) => {
            log.info(`Agent ${buf.toString("hex")} is using id: ${id}`);
            this.sockets.set(id, socket);
            s.parser = new MessageParser(agentEvt, panlEvt, id);
            log.silly(`Start message parser for agent ${s.parser.id}`);
            const engine = s.parser.startParserEngine();
            engine.catch((err: Error) => {
              log.silly(`Message parser for agent ${s.parser.id} ` +
                `stopped: ${err}`);
            });
          });
        }).catch((reject) => {
          log.debug(`Received non Agent ID data ${data}, close socket.`);
          socket.end();
        });
      }
    });

    socket.on("end", () => {
      if (s.parser !== void 0) {
        log.debug("Received socket end event");
        s.parser.stop();
        this.sockets.delete(s.parser.id);
        agentEvt.onAgentEnd(s.parser.id);
      }
    });

    socket.on("error", (err) => {
      if (s.parser !== void 0) {
        log.debug("Received socket error event");
        s.parser.stop();
        this.sockets.delete(s.parser.id);
        agentEvt.onAgentError(s.parser.id, err);
      }
    });

    socket.on("drain", () => {
      log.silly("Received socket drain event");
      if (s.parser !== void 0) {
        agentEvt.onTxDrain(s.parser.id);
      }
    });

    socket.on("timeout", () => {
      log.debug("Received socket timeout event");
      throw new Error("Method not implemented.");
    });

    socket.setKeepAlive(true);
    log.info("Client connected.");
  }
}
