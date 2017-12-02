import {expect} from "chai";
import net = require("net");
import rewire = require("rewire");
import {PanLService} from "../../src/service";

describe("Agent simulator", () => {
  const parser = rewire("../../src/recv");
  let stopCallback: () => Promise<void>;

  before(async () => {
    let service: PanLService;
    [service, stopCallback] = await PanLService.getInstance();
  });
  after(async () => {
    await stopCallback();
  });
  it("should be able to connect PanLHub service", (done) => {
    const client = new net.Socket();
    client.connect(0xF7D1, "127.0.0.1", () => {
      done();
      client.end();
    });
    client.on("error", (err) => {
      done(err);
    });
  });
  it("should be able to send agent ID and receive messages", (done) => {
    const client = new net.Socket();
    client.on("data", (buf) => {
      client.end();
      done();
    });
    client.on("error", (err) => {
      done(err);
    });
    client.connect(0xF7D1, "127.0.0.1", () => {
      const StructReportAgent = parser.__get__("StructReportAgent");
      const Incoming = parser.__get__("Incoming");
      expect(StructReportAgent.size).to.equal(9);
      const buf = new StructReportAgent({
        id: Incoming.REPORT_AGENT_ID,
        uid: 1,
      });
      client.write(buf.ref());
    });
  });
});
