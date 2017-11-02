import {EventEmitter} from "events";
import net = require("net");
import {MessageBuilder} from "./builder";
import {log} from "./log";
import {PanLPath} from "./path";
import {Persist} from "./persist";
import {MessageParser} from "./recv";
import {IMessageTransport, Transmit} from "./xmit";

export class PanLSocketController implements IMessageTransport {
  private sockets: Map<number, net.Socket>;
  private stop: EventEmitter;

  constructor(
    port: number, private persist: Persist, private event: EventEmitter) {
    this.sockets = new Map();
    this.stop = new EventEmitter();
    const server = net.createServer((socket) => {
      const s = socket as any;

      socket.on("data", (data) => {
          if (s.parser) {
            try {
              s.parser.onData(data);
            } catch (e) {
              socket.end();
            }
          } else {
            MessageParser.parseAgentID(data).then((buf) => {
              this.persist.getAgentId(buf).then((id) => {
                this.sockets.set(id, socket);
                s.parser = new MessageParser(this.event, id);
              });
            }).catch((reject) => {
              socket.end();
            });
          }
      });

      socket.on("end", () => {
        if (s.parser !== void 0) {
          this.sockets.delete(s.parser.path.agent);
          s.parser.notify("agentEnd");
        }
      });

      socket.on("error", (err) => {
        if (s.parser !== void 0) {
          this.sockets.delete(s.parser.path.agent);
          s.parser.notify("agentError", err);
        }
      });

      socket.on("drain", () => {
        if (s.parser !== void 0) {
          s.parser.notify("txDrain");
        }
      });

      socket.on("timeout", () => {
        throw new Error("Method not implemented.");
      });

      socket.setKeepAlive(true);
      log.info("Client connected.");
    });

    server.listen(port, () => {
      this.stop.on("stop", () => {
        for (const [agent, socket] of this.sockets) {
          log.info(`Closing socket for agent ${agent}...`);
          socket.end();
        }
        log.info("Closing server...");
        server.close();
      });
      log.info(`Server listen on port ${port}`);
    });
  }

  public onStop(): void {
    this.stop.emit("stop");
  }

  public onGlobalBroadcast(payloads: Buffer[]): void {
    const hdr = MessageBuilder.buildBroadcastTarget(
      Transmit.getTotalLength(payloads));

    for (const [agent, socket] of this.sockets) {
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
        socket.write(payload);
    }
  }
}
