var express = require('express');
var bcrypt = require('bcrypt');
var async = require('async');
var passport = require('passport');
var randomstring = require('randomstring');
var nodemailer = require('nodemailer');
var sesTransport = require('nodemailer-ses-transport');
var sesConfig = require('../config/sesconfig');
var router = express.Router();
var hexkey = process.env.DINER_HEX_KEY;


router.post('/login', function(req, res, next) {
    if (req.secure) {
        var registrationToken = req.body.registrationToken;
        passport.authenticate('local-login', function(err, customer, info) {
            if(err) {
                next(err);
            } else if (!customer) {
                var err = new Error('비밀번호가 일치하지 않아 로그인에 실패하였습니다.');
                err.status = 401;
                err.code = 'E0005b';
                next(err);
            } else {
                req.logIn(customer, function(err) {
                    if (err) {
                        next(err);
                    } else {
                        function getConnection(callback) {
                            pool.getConnection(function (err, connection) {
                                if (err) {
                                  callback(err);
                                }  else {
                                  callback(null, connection);
                              }
                            });
                        }

                        function updateRegistrationToken(connection, callback) {
                            var update = "UPDATE customer " +
                                         "SET registration_token = ? " +
                                         "WHERE customer_id = ?";

                            connection.query(update, [registrationToken, req.user.id], function(err, result) {
                                connection.release();
                                if (err) {
                                    var err = new Error('registrationToken 업데이트가 실패했습니다.');
                                    err.code = '';
                                    callback(err);
                                } else {
                                    callback(null);
                                }
                            });
                        }

                        async.waterfall([getConnection, updateRegistrationToken], function(err) {
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
        //create random password
        var newPassword = randomstring.generate({
            length: 10,
            charset: 'alphanumeric'
        });

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
            var select = "SELECT customer_id, convert(aes_decrypt(email, unhex(" + connection.escape(hexkey) + ")) using utf8) as email " +
                         "FROM customer " +
                         "WHERE email = aes_encrypt(" + connection.escape(email) + ", unhex(" + connection.escape(hexkey) + ")) ";

            connection.query(select, function(err, results) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    if (results.length === 0) {
                        var err = new Error('이메일 계정 확인에 실패하였습니다.');
                        err.status = 401;
                        err.code = 'E0006a';
                        callback(err);
                    } else {
                        var customer = {
                            "id": results[0].customer_id,
                            "email": results[0].email
                        };
                        callback(null, connection, customer);
                    }
                }
            });
        }

        function generateSalt(connection, customer, callback) {
            var rounds = 10;
            bcrypt.genSalt(function(err, salt) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, connection, customer, salt);
                }
            });
        }

        function generateHashPassword(connection, customer, salt, callback) {
            bcrypt.hash(newPassword, salt, function(err, hashPassword) {
                if (err) {
                    callback(err);
                } else {
                    customer.hashPassword = hashPassword;
                    callback(null, connection, customer);
                }
            });
        }

        function pushPassword(connection, customer, callback) {
            connection.beginTransaction(function(err) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {


                    //update hashpassword
                    var update = "UPDATE customer " +
                                 "SET customer_acc_pwd = ? " +
                                 "WHERE customer_id = ?";
                    connection.query(update, [customer.hashPassword, customer.id], function(err, result) {
                        if (err) {
                            connection.rollback();
                            connection.release();
                            callback(err);
                        } else {
                            //push mail
                            var transporter = nodemailer.createTransport(sesTransport({
                                "accessKeyId": sesConfig.key,
                                "secretAccessKey": sesConfig.secret,
                                "region": sesConfig.region
                            }));

                            var data = {
                                "from": "113305ms@gmail.com",
                                "to": customer.email,
                                "subject": "DINER임시 비밀번호 발송 메일 입니다.",
                                "text": "고객님의 임시 비밀번호는 " + newPassword + "입니다.",
                                "html": "고객님의 임시 비밀번호는 <strong>" + newPassword + "</strong>입니다."
                            };

                            transporter.sendMail(data, function(err, info) {
                                if (err) {
                                    connection.rollback();
                                    connection.release();
                                    var err = new Error('비밀번호 재발급에 실패하였습니다.');
                                    err.code = 'E0006a';
                                    callback(err);
                                } else {
                                    connection.commit();
                                    connection.release();
                                    var result = {
                                        "results": {
                                            "message": "비밀번호 재발급이 정상적으로 처리되었습니다."
                                        }
                                    };
                                    callback(null, result);
                                }
                            });
                        }
                    });
                }
            });
        }

        async.waterfall([getConnection, selectCustomer, generateSalt, generateHashPassword, pushPassword], function(err, result) {
            if (err) {
                next(err);
            } else {
                res.json(result);
            }
        });
    } else {
        var err = new Error('SSL/TLS Ugrades Required');
        err.status = 426;
        next(err);
    }
});

module.exports = router;