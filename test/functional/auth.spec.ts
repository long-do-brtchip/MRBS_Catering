import {expect} from "chai";
import {Auth} from "../../src/auth";
import {Database} from "../../src/database";

describe("Auth module", function foo() {
  this.slow(1000);
  describe("employee", () => {
    it("should be able to add employee", async () => {
      const name = "User";
      const db = await Database.getInstance();
      const id = await Auth.addEmployee("user@test.com", name);
      const ret = Auth.getEmployeeName("user@test.com");
      await db.stop();
      expect(ret).to.be.equal(ret);
    });
  });
});
