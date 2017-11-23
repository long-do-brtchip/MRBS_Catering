import "reflect-metadata";
import {Employee} from "./entity/auth/employee";
import {PassCode} from "./entity/auth/passcode";
import {Rfid} from "./entity/auth/rfid";
import {log} from "./log";

export class Auth {
  public static async addEmployee(name: string, email: string):
  Promise<number> {
    const employee = new Employee();
    employee.name = name;
    employee.email = email;
    await employee.save();
    return employee.id;
  }

  public static async addRfid(rfidcode: Buffer):
  Promise<number> {
    const rfid = new Rfid();
    log.debug("rfid" + rfidcode);
    rfid.rfidcode = rfidcode;
    await rfid.save();
    return rfid.id;
  }

  public static async addPasscode(inPassCode: number):
  Promise<number> {
    const varPassCode = new PassCode();
    varPassCode.passcode = inPassCode;
    await varPassCode.save();
    return varPassCode.id;
  }

  public static async authByPasscode(code: number): Promise<string> {
    log.info("passcode authen");
    log.debug("code: ", code.toString(10));
    const varPassCode = await PassCode.findOne(
        {where: {passcode: code.toString(10)}}) as PassCode;
    if (varPassCode === undefined) {
        log.warn("Entry does not exist");
        return "";
    } else {
        const emp = await Employee.findOne(
          {where: {id: varPassCode.employeeid.id}}) as Employee;
        return emp.email;
    }
  }

  public static async linkRFIDtoEmployee(empId: number, rfid: number):
  Promise<void> {
    const Emp = await Employee.findOne(
        {where: {id: empId}}) as Employee;
    const varRfid = await Rfid.findOne(
        {where: {id: rfid}}) as Rfid;
    // Link RFID to Employee
    varRfid.employeeid = Emp;
    await varRfid.save();
  }

  public async linkPassCodetoEmployee(empId: number, passId: number):
  Promise<void> {
    const emp = await Employee.findOne(
        {where: {id: empId}}) as Employee;
    const passCode = await PassCode.findOne(
        {where: {id: passId}}) as PassCode;
    // Link RFID to Employee
    passCode.employeeid = emp;
    await passCode.save();
  }

  public async modifyEmployee(id: number, email: string, name: string):
  Promise<string> {
    let retString = "Update success!";
    const Emp = await Employee.findOne(
        {where: {employeeid: id}}) as Employee;
    if (Emp !== undefined) {
        Emp.name = name;
        Emp.email = email;
        await Emp.save();
    } else {
        log.warn("Cannot find Employee");
        retString = "";
    }
    return retString;
  }

  public async modifyRfid(empID: Employee, rfidcode: Buffer, passcode: number):
  Promise<string> {
    let retString = "Update success!";
    const varRfid = await Rfid.findOne(
        {where: {employeeid: empID.id}}) as Rfid;
    if (varRfid !== undefined) {
        varRfid.rfidcode = rfidcode;
        await varRfid.save();
    } else {
        log.warn("Cannot find Employee");
        retString = "";
    }
    return retString;
  }

  public async modifyPassCode(empID: Employee, passcode: number):
  Promise<string> {
    let retString = "Update success!";
    const varPassCode = await PassCode.findOne(
        {where: {employeeid: empID.id}}) as PassCode;
    if (varPassCode !== undefined) {
      varPassCode.passcode = passcode;
      await varPassCode.save();
    } else {
        log.warn("Cannot find Employee");
        retString = "";
    }
    return retString;
  }

  public async authByRFID(epc: Buffer): Promise<string> {
    log.info("rfid authen");
    const varRfid = await Rfid.findOne(
        {where: {rfidcode: this.convertBufferToString(epc)}}) as Rfid;
    if (varRfid === undefined) {
        return "";
    } else {
      const emp = await Employee.findOne(
        {where: {id: varRfid.employeeid.id}}) as Employee;
      return emp.email;
    }
  }

  private decimalToHexString(input: any): number {
    if (input < 0) {
        input = 0xFF + input + 1;
    }
    return input.toString(16);
  }

  public static async authByRFID(epc: Buffer): Promise<string> {
    return "rfid@test.com";
  }
}
