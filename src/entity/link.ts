import {IsEmail} from "class-validator";
import {BaseEntity, Column, Entity, PrimaryColumn} from "typeorm";

@Entity()
export class Link extends BaseEntity {
  @PrimaryColumn()
  @IsEmail()
  public address: string;

  @Column()
  public name: string;

  @Column("int8")
  public uuid: string;
}
