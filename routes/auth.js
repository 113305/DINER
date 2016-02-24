var express = require('express');
var bcrypt = require('bcrypt');
var async = require('async');
var passport = require('passport');
var router = express.Router();

router.post('/login', function(req, res, next) {
    if (req.secure) {
        var result = {
            "results": {
                "message": "로그인이 정상적으로 처리되었습니다."
            }
        };
        res.json(result);
    } else {
        var err = new Error('SSL/TLS Ugrades Required');
        err.status = 426;
        next(err);
    }
});

//router.post('/facebook/token', function(req, res, next) {
//    if (req.secure) {
//        var result = {
//            "results": {
//                "message": "페이스북 토큰 수신이 정상적으로 처리되었습니다."
//            }
//        };
//        res.json(result);
//    } else {
//        var err = new Error('SSL/TLS Ugrades Required');
//        err.status = 426;
//        next(err);
//    }
//});
//
//router.post('/updatepassword', function(req, res, next) {
//    if (req.secure) {
//        var result = {
//            "results": {
//                "message": "비밀번호 재발급이 정상적으로 처리되었습니다."
//            }
//        };
//        res.json(result);
//    } else {
//        var err = new Error('SSL/TLS Ugrades Required');
//        err.status = 426;
//        next(err);
//    }
//});


module.exports = router;