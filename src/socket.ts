import {EventEmitter} from "events";
import net = require("net");
import {MessageBuilder} from "./builder";
import {Database} from "./database";
import {log} from "./log";
import {PanLPath} from "./path";
import {Persist} from "./persist";
import {MessageParser} from "./recv";
import {IAgentEvent, IPanLEvent} from "./service";
import {IMessageTransport, Transmit} from "./xmit";

export class PanLSocketController implements IMessageTransport {
  private sockets: Map<number, net.Socket>;
  private stop: EventEmitter;

  constructor(port: number, private agentEvt: IAgentEvent,
              panlEvt: IPanLEvent) {
    this.sockets = new Map();
    this.stop = new EventEmitter();
    const server = net.createServer((socket) => {
      const s = socket as any;

      socket.on("data", async (data) => {
          if (s.parser) {
            try {
              log.silly(`Received ${data.byteLength} bytes from Agent` +
                `${s.parser.id}: ${data.toString("hex")}`);
              socket.pause();
              await s.parser.onData(data);
              socket.resume();
            } catch (e) {
              log.debug(`Failed to parse: ${e}, close socket.`);
              socket.end();
            }
          } else {
            MessageParser.parseAgentID(data).then(async (buf) => {
              Database.getInstance().then((db) => {
                Persist.getAgentId(buf).then((id) => {
                    log.info(`Agent ${buf.toString("hex")} is using id: ${id}`);
                    this.sockets.set(id, socket);
                    s.parser = new MessageParser(agentEvt, panlEvt, id);
                  });
                db.stop();
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
          this.sockets.delete(s.parser.id);
          this.agentEvt.onAgentEnd(s.parser.id);
        }
      });

      socket.on("error", (err) => {
        if (s.parser !== void 0) {
          log.debug("Received socket error event");
          this.sockets.delete(s.parser.id);
          this.agentEvt.onAgentError(s.parser.id, err);
        }
      });

      socket.on("drain", () => {
        log.silly("Received socket drain event");
        if (s.parser !== void 0) {
          this.agentEvt.onTxDrain(s.parser.id);
        }
      });

      socket.on("timeout", () => {
        log.debug("Received socket timeout event");
        throw new Error("Method not implemented.");
      });

      socket.setKeepAlive(true);
      log.info("Client connected.");
    });

    server.listen(port, () => {
      this.stop.on("stop", () => {
        for (const [id, socket] of this.sockets) {
          log.info(`Closing socket for agent ${id}...`);
          socket.end();
        }
        log.silly("Close socket");
        server.close();
      });
      log.info(`PanLController listen on port ${port}`);
    });
  }

  public onStop(): void {
    this.stop.emit("stop");
  }

  public onGlobalBroadcast(payloads: Buffer[]): void {
    const hdr = MessageBuilder.buildBroadcastTarget(
      Transmit.getTotalLength(payloads));

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
      Transmit.getTotalLength(payloads));
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
}
