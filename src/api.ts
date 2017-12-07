import express = require("express");
import "reflect-metadata";
import {Cache} from "./cache";
import {Database} from "./database";
import {Panl} from "./entity/hub/panl";
import {Room} from "./entity/hub/room";
import {log} from "./log";
import {Persist} from "./persist";
import {PanLService} from "./service";

export const api = express.Router();
const prodEnv = process.env.NODE_ENV === "production";

async function createRoom(address: string, name: string): Promise<boolean> {
  const room = new Room(address, name);
  try {
    await room.save();
    return true;
  } catch (err) {
    return false;
  }
}

api.route("/rooms").get(async (req, res) => {
  const links = await Room.find();
  return res.json(links);
}).post(async (req, res) => {
  if (req.body.address === undefined || req.body.name === undefined) {
    return res.sendStatus(400);
  }
  return res.sendStatus(
    await createRoom(req.body.address, req.body.name) ? 201 : 500);
});

api.route("/room/:address/:name").get(async (req, res) => {
  if (prodEnv) {
    return res.sendStatus(403);
  }
  if (req.params.address === undefined || req.params.name === undefined) {
    return res.sendStatus(400);
  }
  return res.sendStatus(
    await createRoom(req.params.address, req.params.name) ? 201 : 500);
});

api.route("/room/:address").all(async (req, res, next) => {
  const link = await Room.findOne(
    {where: {address : req.params.address}});
  if (link === undefined) {
    return res.sendStatus(410);
  } else {
    res.locals.link = link;
  }
  next();
}).get((req, res) => {
  return res.json(res.locals.link);
}).patch(async (req, res) => {
  if (req.body.name !== undefined) {
    res.locals.link.name = req.body.name;
  }
  res.locals.link.uuid = req.body.uuid ? req.body.uuid : "0";
  try {
    await res.locals.link.save();
  } catch (err) {
    return res.sendStatus(500);
  }
  res.sendStatus(204);
}).delete(async (req, res) => {
  try {
    await res.locals.link.remove();
  } catch (err) {
    return res.sendStatus(500);
  }
  res.sendStatus(204);
});

api.route("/panl/:id/:address").get(async (req, res) => {
  if (req.params.address === undefined || req.params.id === undefined) {
    return res.sendStatus(400);
  }
  const cache = await Cache.getInstance();
  const panl = await cache.getUnconfigured(Number(req.params.id));
  await cache.stop();
  if (panl === undefined) {
    return res.status(410).send(`Invalid id ${req.params.id}`);
  }

  const [path, uuid] = panl;
  const room = await Persist.findRoom(req.params.address);
  if (room === undefined) {
    return res.status(410).send(`Invalid room address ${req.params.address}`);
  }
  await Persist.linkPanL(uuid, room);
  await req.app.locals.service.onReportUUID(path, uuid);
  return res.sendStatus(204);
});
