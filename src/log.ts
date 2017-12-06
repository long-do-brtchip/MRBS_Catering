import {Logger, LoggerInstance, transports} from "winston";

export let log: LoggerInstance;
const ts = () => (new Date()).toLocaleTimeString();

switch (process.env.NODE_ENV) {
  case "production":
    // The log level should be configurable from UI
    throw new Error("Method not implemented.");
  case "test":
    log = new Logger({
      level: "error",
      transports: [
        new transports.Console({colorize: true, timestamp: ts}),
      ],
    });
    break;
  default:
    log = new Logger({
      level: "silly",
      transports: [
        new transports.Console({colorize: true, timestamp: ts}),
      ],
    });
    process.on("unhandledRejection", (r) => log.error(r));
}

log.verbose("Log instance created");
