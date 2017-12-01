import {assert, expect} from "chai";
import {Database} from "../../src/database";
import {Persist} from "../../src/persist";

describe("Persist module", function foo() {
  this.slow(1000);
  let db: Database;
  const panlUuids = [
    new Buffer([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
    new Buffer([0x08, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
    new Buffer([0xFF, 0xFF, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]),
  ];
  const rooms = [
    {addr: "test_room1@ftdi.local", name: "Test Room 1"},
    {addr: "test_room2@ftdi.local", name: "Test Room 2"},
  ];

  before(async () => {
    db = await Database.getInstance();
  });

  after(async () => {
    await db.dropSchemas();
  });

  describe("agent", () => {
    it("should be able to generate unique agent id", async () => {
      const [id0, id1, id2] = [
        await Persist.getAgentId(panlUuids[0]),
        await Persist.getAgentId(panlUuids[0]),
        await Persist.getAgentId(panlUuids[1]),
      ];
      expect(id0).to.equal(id1);
      expect(id1).to.not.equal(id2);
    });
  });

  describe("room and PanL", () => {
    it("should be able to add room", async () => {
      await Persist.addRoom(rooms[0].addr, rooms[0].name);
      await Persist.addRoom(rooms[0].addr, rooms[0].name);
      await Persist.addRoom(rooms[1].addr, rooms[1].name);
      expect(await Persist.findRoom(rooms[0].addr)).to.not.equal(undefined);
    });
    it("should be able to link room to PanL", async () => {
      const room1 = await Persist.findRoom(rooms[0].addr);
      const room2 = await Persist.findRoom(rooms[1].addr);
      if (room1 === undefined || room2 === undefined) {
        assert(room1 !== undefined && room2 !== undefined);
      } else {
        await Persist.linkPanL(panlUuids[0], room2);
        await Persist.linkPanL(panlUuids[0], room1);
        const room = await Persist.findPanlRoom(panlUuids[0]);
        if (room === undefined) {
          assert(room);
        } else {
          expect(room.address).to.equal(room1.address);
        }
      }
      expect(await Persist.findPanlRoom(panlUuids[2])).to.equal(undefined);
    });
    it("should be able to remove PanL", async () => {
      await Persist.removePanL(panlUuids[2]);
      await Persist.removePanL(panlUuids[1]);
      await Persist.removePanL(panlUuids[0]);
      const room = await Persist.findPanlRoom(panlUuids[0]);
      assert(room === undefined);
    });
  });

  describe("calendar", () => {
    it("should be able to set calendar setting");
    it("should be able to get calendar setting");
    it("shall generate default calendar setting after factory reset");
  });
});
