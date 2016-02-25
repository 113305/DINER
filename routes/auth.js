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


//페이스북가입처리가 완료된후 '/customer/me'을 이용해 이메일과 전화번호를 입력 받아야함.
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
        })(req, res, next);
    } else {
        var err = new Err('SSL/TLS Upgrades Required');
        err.status = 426;
        next(err);
    }
});

router.post('/updatepassword', function(req, res, next) {
    if (req.secure) {
        var email = req.body.email;

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            });
        }

        function selectCustomer(connection, callback) {
            var select = "SELECT id, email " +
                         "FROM dinerdb.customer " +
                         "WHERE email = ?";

            connection.query(select, [email], function(err, results) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    if (results.length === 0) {
                        var err = new Error('이메일 계정 확인에 실패하였습니다.');
                        err.status = 401;
                        err.code = 'E0006';
                        callback(err);
                    } else {
                        var customer = {
                            "id": results[0].id,
                            "email": results[0].email
                        };
                        callback(null, connection, customer);
                    }
                }
            });
        }

        function updatePassword(connection, customer, callback) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                var update = "";

                connection.query(update, [], function(err, result) {

                });
            }
        }

        async.waterfall([getConnection, selectCustomer], function(err) {
            if (err) {
                next(err);
            } else {

            }
        });
    } else {
        var err = new Error('SSL/TLS Ugrades Required');
        err.status = 426;
        next(err);
    }
});


module.exports = router;