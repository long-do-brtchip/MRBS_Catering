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
  Promise<void> {
    const rfid = new Rfid();
    rfid.rfidcode = rfidcode;
    await rfid.save();
  }

  public static async addPasscode(inPassCode: number):
  Promise<void> {
    const passCode = new PassCode();
    passCode.passcode = inPassCode;
    await passCode.save();
  }

  public static async authByPasscode(code: number): Promise<string> {
    const passCode = await PassCode.findOne(
        {where: {passcode: code}}) as PassCode;
    if (passCode === undefined) {
        log.warn("Entry does not exist");
        return "";
    } else {
        const emp = await Employee.findOne(
          {where: {id: passCode.employee.id}}) as Employee;
        return emp.email;
    }
  }

  public static async linkRFIDtoEmployee(empId: number, rfid: number):
  Promise<void> {
    const emp = await Employee.findOne(
        {where: {id: empId}}) as Employee;
    const varRfid = await Rfid.findOne(
        {where: {id: rfid}}) as Rfid;
    // Link RFID to Employee
    varRfid.employee = emp;
    await varRfid.save();
  }

  public async linkPassCodetoEmployee(empId: number, code: number):
  Promise<void> {
    const emp = await Employee.findOne(
        {where: {id: empId}}) as Employee;
    const passCode = await PassCode.findOne(
        {where: {passcode: code}}) as PassCode;
    // Link RFID to Employee
    passCode.employee = emp;
    await passCode.save();
  }

  public async modifyEmployee(id: number, email: string, name: string):
  Promise<string> {
    let retString = "Update success!";
    const emp = await Employee.findOne(
        {where: {employeeid: id}}) as Employee;
    if (emp !== undefined) {
        emp.name = name;
        emp.email = email;
        await emp.save();
    } else {
        log.warn("Cannot find Employee");
        retString = "";
    }
    return retString;
  }

  public async modifyRfid(empID: Employee, rfidcode: Buffer, passcode: number):
  Promise<string> {
    let retString = "Update success!";
    const rfid = await Rfid.findOne(
        {where: {employeeid: empID.id}}) as Rfid;
    if (rfid !== undefined) {
        rfid.rfidcode = rfidcode;
        await rfid.save();
    } else {
        log.warn("Cannot find Employee");
        retString = "";
    }
    return retString;
  }

  public async modifyPassCode(empID: Employee, passcode: number):
  Promise<string> {
    let retString = "Update success!";
    const passCode = await PassCode.findOne(
        {where: {employee: empID.id}}) as PassCode;
    if (passCode !== undefined) {
        passCode.passcode = passcode;
      await passCode.save();
    } else {
        log.warn("Cannot find Employee");
        retString = "";
    }
    return retString;
  }

  public async authByRFID(epc: Buffer): Promise<string> {
    log.info("rfid authen");
    const rfid = await Rfid.findOne(
        {where: {rfidcode: epc}}) as Rfid;
    if (rfid === undefined) {
        return "";
    } else {
      const emp = await Employee.findOne(
        {where: {id: rfid.employee.id}}) as Employee;
      return emp.email;
    }
  }
}
