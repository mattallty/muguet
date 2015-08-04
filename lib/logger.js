var winston = require('winston')
//
// Configure CLI output on the default logger
//
winston.cli()

//
// Configure CLI on an instance of winston.Logger
//
var logger = new winston.Logger({
  transports: process.env.TEST_MODE === '1' ? [] : [
    new (winston.transports.Console)()
  ]
})

logger.cli()

module.exports = logger