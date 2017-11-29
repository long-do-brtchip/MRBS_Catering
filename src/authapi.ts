import bodyParser = require("body-parser");
import express = require("express");
import "reflect-metadata";
import {Auth} from "./auth";
import {Employee} from "./entity/auth/employee";
import {PassCode} from "./entity/auth/passcode";
import {Rfid} from "./entity/auth/rfid";
import {log} from "./log";

export const authapi = express.Router();
const jsonParser = bodyParser.json();

// Read Employee
authapi.route("/employee/:id").get(async (req, res) => {
    try {
        log.debug("authapi");
        const employee = await Employee.findOne(
            {where: {id: req.params.id}}) as Employee;
        if (employee !== undefined) {
            res.json(employee);
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        log.error("Ops!:", err);
    }
});

// Read RFID 
authapi.route("/rfid/:id").get(async (req, res) => {
    try {
        log.silly("authapi");
        const rfid = await Rfid.findOne(
            {where: {id: req.params.id}}) as Rfid;
        if (rfid !== undefined) {
            res.json(rfid);
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        log.error("Ops!:", err);
    }
});

// Add Employee
authapi.route("/employee/:name/:email").post(async (req, res) => {
    const employee = await Employee.findOne(
        {where: {name: req.params.name}}) as Employee;
    if (employee === undefined) {
        Auth.addEmployee(req.params.name, req.params.email)
        .then((data) => {
            res.status(201).send("Add employee succesfully, id = " + data);
        });
    } else {
        res.status(412).send("Employee existed!");
    }
});

// Add RFID
authapi.route("/rfid/:rfidcode").post(async (req, res) => {
    const rfid = await Rfid.findOne(
        {where: {rfidcode: req.params.rfidcode}}) as Rfid;
    if (rfid === undefined) {
        Auth.addRfid(req.params.rfidcode)
        .then((data) => {
            res.status(201).send("Add rfid succesfully");
        });
    } else {
        res.status(412).send("Employee existed");
    }
});

// Add Passcode
authapi.route("/passcode/:code").post(async (req, res) => {
    const passcode = await PassCode.findOne(
        {where: {passcode: req.params.code}}) as PassCode;
    if (passcode === undefined) {
        Auth.addPasscode(req.params.code)
        .then((data) => {
            res.status(201).send("Add passcode succesfully");
        });
    } else {
        res.status(412).send("Employee existed");
    }
});

// Link Passcode to Employee
authapi.route("/passcode/:empId/:code").post(async (req, res) => {
    const passCode = await PassCode.findOne(
        {where: {passCode: req.params.code}}) as PassCode;
    const employee = await Employee.findOne(
        {where: {id: req.params.empId}}) as Employee;
    if ((employee !== undefined) && (passCode !== undefined)) {
        Auth.linkPassCodetoEmployee(req.params.empId, req.params.code)
        .then((data) => {
            res.status(202).send("Linked Passcode to Employee success!");
        });
    } else if (employee === undefined) {
        res.status(404).send("Employee Id does not exist !");
    } else if (passCode === undefined) {
        res.status(404).send("Passcode Id does not exist !");
    } else {
        res.sendStatus(404);
    }
});

// Link RFID to Employee
authapi.route("/rfid/:empId/:rfid").post(async (req, res) => {
    const ret =
        await Auth.linkRFIDtoEmployee(req.params.empId, req.params.rfid);
    if (ret === 0) {
        res.status(202).send("Linkd RFID to Employee success!");
    } else if (ret === 2) {
        res.status(404).send("Employee Id does not exist !");
    } else if (ret === 1) {
        res.status(404).send("RFID Id does not exist !");
    } else {
        res.sendStatus(404);
    }
});

// Modify Employee
authapi.route("/employee/:id/:name/:email").patch(async (req, res) => {
    const employee = await Employee.findOne(
        {where: {id: req.params.id}}) as Employee;
    if (employee !== undefined) {
      employee.name = req.params.name;
      employee.email = req.params.email;
      await employee.save();
      res.sendStatus(200);
    } else {
        res.status(404).send("Employee does not exist!");
    }
});

// Modify Rfid
authapi.route("/rfid/:id/:rfid").patch(async (req, res) => {
  const rfid = await Rfid.findOne(
      {where: {id: req.params.id}}) as Rfid;
  if (rfid !== undefined) {
    rfid.rfidcode = req.params.rfid;
    await rfid.save();
    res.sendStatus(200);
  } else {
      res.status(404).send("Rfid ID does not exist!");
  }
});

// Modify Passcode
authapi.route("/passcode/:oldcode/:newcode").patch(async (req, res) => {
  const passcode = await PassCode.findOne(
      {where: {passcode: req.params.oldcode}}) as PassCode;
  if (passcode !== undefined) {
    passcode.passcode = req.params.newcode;
    await passcode.save();
    res.sendStatus(200);
  } else {
      res.status(404).send("Passcode does not exist!");
  }
});

// Remove Employee
authapi.route("/employee/:id").delete(async (req, res) => {
    const employee = await Employee.findOne(
        {where: {id: req.params.id}}) as Employee;
    if (employee !== undefined) {
      await employee.remove();
      res.sendStatus(200);
    } else {
        res.status(404).send("Employee does not exist!");
    }
});

// Remove RFID
authapi.route("/rfid/:rfidcode").delete(async (req, res) => {
    const rfid = await Rfid.findOne(
        {where: {id: req.params.rfidcode}}) as Rfid;
    if (rfid !== undefined) {
      rfid.remove();
      res.sendStatus(200);
    } else {
        res.status(404).send("Rfid does not exist!");
    }
});

// Remove Passcode
authapi.route("/passcode/:code").delete(async (req, res) => {
    const passcode = await Rfid.findOne(
        {where: {passcode: req.params.code}}) as PassCode;
    if (passcode !== undefined) {
        passcode.remove();
      res.sendStatus(200);
    } else {
        res.status(404).send("Passcode does not exist!");
    }
});
