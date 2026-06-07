
import { createLogger, format, transports } from 'winston';

//!
//!//!
//Create a logger object
export const logger = createLogger({
  // check the environment -> onlt logs are info warn and error debug
  // here node_env is development thus mode is debug
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

  //combines multiple formats together
  format: format.combine(
    //Adds current date and time to every log
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    // captures completed error details -> logger.error(err) ! then sends error:db failes
    format.errors({ stack: true }),
    // converts logs into json
    format.json()
  ),
  // transport determins where to go
  transports: [
    // logs are displayed in terminal
    new transports.Console({
      // applies console=specific formating
      format: format.combine(
        // adds colors to log levels
        format.colorize(),
        // destructures the log objects
        format.printf(({ timestamp, level, message, ...meta }) => {
          //Checks if extra data exists.
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      )
    })
  ]
});
