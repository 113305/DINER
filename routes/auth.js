var express = require('express');
var bcrypt = require('bcrypt');
var async = require('async');
var passport = require('passport');
var router = express.Router();


router.post('/login', function(req, res, next) {
    if (req.secure) {
        passport.authenticate('local-login', function(err, customer, info) {
            if(err) {
                next(err);
            } else if (!customer) {
                var err = new Error('비밀번호가 일치하지 않아 로그인에 실패하였습니다.');
                err.status = 401;
                err.code = 'E0005b';
                next(err);
            } else {
                req.logIn(user, function(err) {
                    if (err) {
                        next(err);
                    } else {
                        var result = {
                            "results": {
                                "message": "로그인이 정상적으로 처리되었습니다."
                            }
                        };
                        res.json(result);
                    }
                });
            }
        })(req, res, next);
    } else {
        var err = new Error('SSL/TLS Ugrades Required');
        err.status = 426;
        next(err);
    }
});

router.post('/facebook/token', function(req, res, next) {
    if (req.secure) {
        passport.authenticate('facebook-token', function(err, customer, info) {
            if (err) {
                var err = new Error('페이스북 토큰 수신에 실패하였습니다.');
                err.code = 'E0002';
                next(err);
            } else {
                req.logIn(customer, function(err) {
                    if (err) {
                        next(err);
                    } else {
                        var result = {
                          "results": {
                              "message": "페이스북 토큰 수신이 정상적으로 처리되었습니다."
                          }
                        };
                        req.json(result);
                    }
                });
            }
        });
    } else {
        var err = new Err('SSL/TLS Upgrades Required');
        err.status = 426;
        next(err);
    }
});

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