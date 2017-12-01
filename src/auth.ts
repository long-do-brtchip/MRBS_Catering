import "reflect-metadata";
import {Employee} from "./entity/auth/employee";
import {Passcode} from "./entity/auth/passcode";
import {Rfid} from "./entity/auth/rfid";
import {log} from "./log";

export class Auth {
  public static async addEmployee(email: string, name: string) {
    let employee = await Employee.findOne({where: {email}}) as Employee;
    if (!employee) {
      employee = new Employee(email);
    }
    employee.name = name;
    await employee.save();
    return employee;
  }

  public static async getEmployeeName(email: string): Promise<string> {
    const employee = await Employee.findOne({where: {email}}) as Employee;
    return employee.name;
  }

  public static async setPasscode(employee: Employee, passcode: number) {
    let pass = await Passcode.findOne({where: {passcode}});
    if (pass) {
      throw(new Error("Passcode is not unique"));
    }
    pass = new Passcode();
    pass.passcode = passcode;
    pass.employee = employee;
    await pass.save();
  }

  public static async addRFID(employee: Employee, epc: Buffer) {
    let rfid = await Rfid.findOne({where: {epc}});
    if (!rfid) {
      rfid = new Rfid();
      rfid.epc = epc;
    }
    rfid.employee = employee;
    await rfid.save();
  }

  public static async authByPasscode(code: number): Promise<string> {
    const passcode = await Passcode.findOne({
      where: {passcode: code}, relations: ["employee"],
    });
    if (!passcode) {
      return "";
    }
    return passcode.employee.email;
  }

  public static async authByRFID(epc: Buffer): Promise<string> {
    const rfid = await Rfid.findOne({where: {epc}});
    if (!rfid) {
      return "";
    }
    return rfid.employee.email;
  }
}
