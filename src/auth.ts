import "reflect-metadata";
import {Employee} from "./entity/auth/employee";
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
}
