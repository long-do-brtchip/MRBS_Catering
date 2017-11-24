import "reflect-metadata";
import {Database} from "./database";
import {Employee} from "./entity/auth/employee";
import {PassCode} from "./entity/auth/passcode";
import {Rfid} from "./entity/auth/rfid";
import {log} from "./log";

export class Auth {
  public static async addEmployee(name: string, email: string):
  Promise<void> {
    const employee = new Employee();
    employee.name = name;
    employee.email = email;
    await employee.save();
  }

  public static async getEmployeeName(email: string): Promise<string> {
    const employee = await Employee.findOne({where: {email}}) as Employee;
    return employee.name;
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
    const emp = await PassCode.findOne(
      {where: {passcode: code}, relations: ["employee"]});
    if (emp === undefined) {
      log.warn("Entry does not exist");
      return "";
    } else {
      return emp.employee.email;
    }
  }

  public static async authByRFID(epc: Buffer): Promise<string> {
    const emp = await Rfid.findOne(
      {where: {rfidcode: this.convertBufferToString(epc)},
      relations: ["employee"]});
    if (emp === undefined) {
      log.warn("Entry does not exist");
      return "";
    } else {
      return emp.employee.email;      
    }
  }

  public static async linkPassCodetoEmployee(empId: number, code: number):
  Promise<void> {
    const emp = await Employee.findOne(
        {where: {id: empId}}) as Employee;
    const passCode = await PassCode.findOne(
        {where: {passcode: code}}) as PassCode;
    // Link RFID to Employee
    passCode.employee = emp;
    await passCode.save();
  }

  public static async linkRFIDtoEmployee(empId: number, rfidId: number):
  Promise<number> {
    const emp = await Employee.findOne(
        {where: {id: empId}}) as Employee;
    const rfid = await Rfid.findOne(
        {where: {id: rfidId}}) as Rfid;
    if (rfid === undefined) {
        log.warn("no rfid");
        return 2;
    } else if (emp === undefined) {
        log.warn("no rfid");
        return 1;
    } else {
        rfid.employee = emp;
        await rfid.save();
        return 0;
    }
  }

  public static decimalToHexString(input: any): number {
    if (input < 0) {
        input = 0xFF + input + 1;
    }
    return input.toString(16);
  }

  public static convertBufferToString(input: Buffer): string {
    let retString = this.decimalToHexString(input[0]);
    for (let i = 1; i < input.length; i++) {
        retString = retString + this.decimalToHexString(input[i]);
    }
    return retString.toString();
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

  public async modifyRfid(empID: Employee, rfidcode: Buffer):
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
}
