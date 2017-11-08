import {assert, expect, use} from "chai";
import chaiAsPromised = require("chai-as-promised");
import {Cache} from "../../src/cache";
import {PanLPath} from "../../src/path";

describe("Cache module", () => {
  let cache: Cache;

  before(async () => {
    use(chaiAsPromised);
    cache = await Cache.getInstance();
    await cache.flush();
  });
  after(async () => {
    await cache.stop();
  });

  describe("Unconfigured ID", () => {
    const uuids: Buffer[] = [
      new Buffer([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
      new Buffer([0x02, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
      new Buffer([0x03, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
    ];
    it("flush should reset number", async () => {
      const results = await Promise.all([
        cache.addUnconfigured(new PanLPath(1, 1), uuids[0]),
        cache.addUnconfigured(new PanLPath(1, 2), uuids[1]),
      ]);
      await cache.flush();
      const now = await cache.addUnconfigured(new PanLPath(1, 2), uuids[1]);
      expect(results[0]).to.equal(now);
    });
    it("should increase for new path", async () => {
      await cache.flush();
      const results = await Promise.all([
        cache.addUnconfigured(new PanLPath(1, 1), uuids[0]),
        cache.addUnconfigured(new PanLPath(1, 2), uuids[1]),
        cache.addUnconfigured(new PanLPath(1, 3), uuids[2]),
      ]);
      expect(results[0] + 2).to.equal(results[2]);
    });
    it("should be the same for the same path", async () => {
      expect(await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]))
        .to.equal(await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]));
    });
    it("should be the same after reconnect database", async () => {
      const id = await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]);
      await cache.stop();
      cache = await Cache.getInstance();
      expect(id).to.equal(
        await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]));
      expect(id).to.not.equal(
        await cache.addUnconfigured(new PanLPath(1, 2), uuids[1]));
    });
    it("should be the same after reconnect agent", async () => {
      const id = await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]);
      await cache.removeAgent(1);
      expect(await cache.addUnconfigured(new PanLPath(1, 1), uuids[0]))
        .to.equal(id);
    });
  });
  const path1 = new PanLPath(1, 1);
  const path2 = new PanLPath(1, 2);
  describe("Configured ID", () => {
    it("should linked to room name and address", async () => {
      const path4 = new PanLPath(1, 4);
      await cache.addUnconfigured(path1,
        new Buffer([0x04, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
      await cache.addConfigured(
        path1, {address: "test1@ftdi.local", name: "Test Room 1"});
      await cache.addConfigured(
        path2, {address: "test2@ftdi.local", name: "Test Room 2"});
      await cache.addConfigured(
        path4, {address: "test4@ftdi.local", name: "Test Room 4"});
      expect(await cache.getRoomAddress(path1)).equal("test1@ftdi.local");
      expect(await cache.getRoomAddress(path2)).equal("test2@ftdi.local");
      expect(await cache.getRoomName(path1)).equal("Test Room 1");
      expect(await cache.getRoomName(path2)).equal("Test Room 2");
    });
    it("linked room address shall be removed after agent disconnected",
      async () => {
      await cache.removeAgent(1);
      expect(cache.getRoomAddress(path1)).to.be.rejectedWith(Error);
      expect(cache.getRoomAddress(path2)).to.be.rejectedWith(Error);
      expect(cache.getRoomName(path1)).to.be.rejectedWith(Error);
      expect(cache.getRoomName(path2)).to.be.rejectedWith(Error);
    });
    it("should be able to saved to pending list", async () => {
      await cache.addPending(path1);
      await cache.addPending(path2);
      let list = [path1, path2];
      await cache.consumePending((path) => {
        list = list.filter((item) => item.uid !== path.uid);
      });
      expect(list.length).to.equal(0);
    });
  });
});
