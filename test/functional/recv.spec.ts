import {expect} from "chai";
import ref = require("ref");
import StructType = require("ref-struct");
import rewire = require("rewire");

describe("Incoming Message Parser module", () => {
  const parser = rewire("../../src/recv");
  describe("parseAgentID", () => {
    it("buffer size should be equal to 9", () => {
      const StructReportAgent = parser.__get__("StructReportAgent");
      expect(StructReportAgent.size).to.equal(9);
    });
  });
});
