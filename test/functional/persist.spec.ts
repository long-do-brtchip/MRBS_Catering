import {assert, expect} from "chai";
import {v4} from "uuid";
import {Database} from "../../src/database";
import {Persist} from "../../src/persist";

describe("Persist module", function foo() {
  this.slow(1000);
  describe("connection", () => {
    it("should be able to connect and disconnect", async () => {
      const db = await Database.getInstance();
      await db.stop();
    });
  });
  describe("agent", () => {
    it("should be able to generate unique agent id", async () => {
      const db = await Database.getInstance();
      const id0 = await Persist.getAgentId(
        new Buffer([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
      const id1 = await Persist.getAgentId(
        new Buffer([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
      const id2 = await Persist.getAgentId(
        new Buffer([0x08, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
      const buf = Buffer.allocUnsafe(8);
      v4(undefined, buf, 0);
      const id3 = await Persist.getAgentId(buf);
      await db.stop();
      expect(id0).to.equal(id1);
      expect(id1).to.not.equal(id2);
    });
  });
  describe("room and PanL", () => {
    it("should be able to add room", async () => {
      const db = await Database.getInstance();
      await Persist.addRoom(
        {address: "test_room1@ftdi.local", name: "Test Room 1"});
      await Persist.addRoom(
        {address: "test_room1@ftdi.local", name: "Test Room 1"});
      await Persist.addRoom(
        {address: "test_room2@ftdi.local", name: "Test Room 2"});
      await db.stop();
    });

    const fakeUUID =
      new Buffer([0xFF, 0xFF, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const panlUUID =
      new Buffer([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    it("should be able to link room to PanL", async () => {
      const db = await Database.getInstance();
      await Persist.linkPanL(panlUUID, "test_room1@ftdi.local");
      await Persist.linkPanL(panlUUID, "test_room3@ftdi.local");
      await db.stop();
    });
    it("should be able to find linked room from PanL UUID", async () => {
      const db = await Database.getInstance();
      const room = await Persist.findRoom(panlUUID);
      const noRoom = await Persist.findRoom(fakeUUID);
      await db.stop();
      expect(noRoom).to.equal(undefined);
      expect(room).to.not.equal(undefined);
      if (room) {
        expect(room.address).to.equal("test_room1@ftdi.local");
        expect(room.name).to.equal("Test Room 1");
      }
    });
    it("should be able to remove PanL", async () => {
      const db = await Database.getInstance();
      await Persist.removePanL(panlUUID);
      await Persist.removePanL(fakeUUID);
      const room = await Persist.findRoom(panlUUID);
      await db.stop();
      assert(room === undefined);
    });
  });
  describe("calendar", () => {
    it("should be able to set calendar setting");
    it("should be able to get calendar setting");
    it("shall generate default calendar setting after factory reset");
  });
});
