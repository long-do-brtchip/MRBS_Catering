import {expect} from "chai";
import ref = require("ref");
import StructType = require("ref-struct");

describe("Incoming Message Parser module", () => {
  describe("parseAgentID", () => {
    it("buffer size should be equal to 9", () => {
      const StructReportAgent = StructType({
        id: ref.types.uint8,
        uid: ref.types.uint64,
      }, {packed: true});
      expect(StructReportAgent.size).to.equal(9);
    });
  });
});
