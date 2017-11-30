import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, OneToOne,
  PrimaryColumn, UpdateDateColumn } from "typeorm";
import { Employee } from "./employee";

@Entity()
export class Passcode extends BaseEntity {
  @PrimaryColumn("int")
  public passcode: number;

  @OneToOne((type) => Employee)
  @JoinColumn()
  public employee: Employee;
}
