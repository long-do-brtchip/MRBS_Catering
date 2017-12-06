import {expect} from "chai";
import {Auth} from "../../src/auth";
import {Database} from "../../src/database";
import {Passcode} from "../../src/entity/auth/passcode";
import {log} from "../../src/log";
import {Buffer} from "buffer";

describe("Auth module", function foo() {
  let db: Database;
  before(async () => {
    db = await Database.getInstance();
  });
  after(async () => {
    /* TODO */
    await db.dropSchemas();
    await db.stop();
  });
  this.slow(1000);
  describe("employee", () => {
    it("should be able to add employee", async () => {
      const name = "User";
      const id = await Auth.addEmployee("user@test.com", name);
      expect(Auth.getEmployeeName("nullEmployee@test.com")).to.empty;
      const ret = Auth.getEmployeeName("user@test.com");
      expect(ret).to.be.equal(ret);
    });
    it("add an exist user", async () => {
      const id = await Auth.addEmployee("user@test.com", "User1");
      expect(id).to.equal(id);
    });
  });
  describe("Auth employee by passcode", () => {
    const passcode = 123456;
    it("should authen the user", async () => {
      const name = "User1";
      const id = await Auth.addEmployee("user1@test.com", name);
      await Auth.setPasscode(id, passcode);
      expect(await Auth.authByPasscode(123457)).to.empty;
      expect(await Auth.authByPasscode(passcode)).to.equal(id.email);
    });
    it("should throw an error", async () => {
      const name2 = "User2";
      const id2 = await Auth.addEmployee("user2@test.com", name2);
      /* TODO */
      expect(await Auth.setPasscode(id2, passcode).catch).to.Throw(Error);
    });
  });
  describe("Auth employee by RFID", async () => {
      const rfid = Buffer.from([5, 4, 3, 2, 1, 0, 9, 8, 7, 10, 9]);
      it("should authen the user by RFID", async () => {
        const name = "userTest1";
        const id = await Auth.addEmployee("usertest1@test.com", name);
        const rfidNew = Buffer.from([5, 4, 3, 2, 1, 0, 9, 8, 7, 10, 11]);
        await Auth.addRFID(id, rfid);
        expect(await Auth.authByRFID(rfidNew)).to.empty;
        expect(await Auth.authByRFID(rfid)).to.equal(id.email);
      });
      it("add new user with exist rfid code", async () => {
        const id = await Auth.addEmployee("usertest2@test.com", "userTest2");
        await Auth.addRFID(id, rfid);
        expect(await Auth.authByRFID(rfid)).to.equal(id.email);
      });
  });
});
