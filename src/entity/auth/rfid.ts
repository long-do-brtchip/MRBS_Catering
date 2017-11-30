import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne,
     PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Employee } from "./employee";

@Entity()
export class Rfid extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column("blob")
  public epc: Buffer;

  @ManyToOne(
    (type) => Employee,
    (employee) => employee.rfids,
    {onDelete: "CASCADE"},
  )
  public employee: Employee;
}
