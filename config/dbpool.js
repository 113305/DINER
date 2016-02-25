var mysql = require('mysql');
var dbconfig = require('./dbconfig');

var pool = mysql.createPool(dbconfig);

module.exports = pool;