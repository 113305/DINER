
var winston = require('winston');
var dailyRotateFile = require('winston-daily-rotate-file');

var config = {
    transports: [
        new dailyRotateFile({
            name: 'debugLogger',
            level: 'debug',
            filename:'debug-',
            datePattern: 'yyyy-MM-dd_HH.log',
            json: false
        })
    ]
};

var logger = new winston.Logger(config);

module.exports = logger;