var express = require('express');
var bcrypt = require('bcrypt');
var async = require('async');
var router = express.Router();

// TODO: show 확인하기 (QR) (/reservations HTTP GET)

// TODO: show 확인하기 (check) (/reservations/:reservationId HTTP POST) aㅁ니선언니가 하기루함 


// TODO: 예약하기 (/reservations HTTP POST)
router.post('/', function (req, res, next) {
    //function getConnection
});
// TODO: 예약 변경/취소 (/reservations/:reservationId HTTP PUT)


module.exports = router;
