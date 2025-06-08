import { createLogger, format, Logger, transports } from "winston"
import path from "path"
import { TransformableInfo } from "logform"

const templateFunction = (info: {
  timestamp: string
  level: string
  message: string
  label: string
}): string =>
  `${info.timestamp} ${info.label}  ${info.level.toUpperCase()}\t${info.message}`

export const create = (name: string): Logger =>
  createLogger({
    level: "info",
    format: format.combine(
      format.timestamp(),
      format.label({ label: path.basename(name) }),
      format.printf(templateFunction as (info: TransformableInfo) => string)
    ),
    transports: [new transports.Console()],
  })
