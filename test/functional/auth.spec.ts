import {assert, expect} from "chai";
import {v4} from "uuid";
import {Auth} from "../../src/auth";
import {Database} from "../../src/database";

describe("Auth module", function foo() {
  this.slow(1000);
  describe("employee", () => {
    it("should be able to add employee", async () => {
      const db = await Database.getInstance();
      const id = await Auth.addEmployee("User", "user@test.com");
      await db.stop();
      expect(id).to.be.a("number");
    });
  });
});
