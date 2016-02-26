// TODO: 회원가입하기(/customer HTTPS POST) 암호화필요
var express = require('express');
var bcrypt = require('bcrypt');
var async = require('async');
var router = express.Router();

router.post('/', function (req, res, next) {
    if (req.secure) {
    var name = req.body.name;
    var password = req.body.password;
    var phone = req.body.phone;
    var email = req.body.email;

        function getConnection (callback) {
            pool.getConnection(function(err, connection) {
               if (err) {
                   callback(err);
               } else {
                   callback(null, connection);
               }
            });
        }

        function selectCustomer (connection, callback) {
            var sql = "SELECT id "+
                      "FROM customer " +
                      "WHERE email = ?";
            connection.query(sql, [email], function (err, results) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    if(results.length) {
                        connection.release();
                        var err = new Error('이미 사용자가 존재합니다.');
                        err.status = 409;
                        err.code = "E0001a";
                        next(err);
                    } else {
                        callback(null, connection);
                    }
                }
            });
        }

        //TODO: 1. salt generation (원본 암호를 암호화)
        function generateSalt (connection, callback) {
            var rounds = 10;
            bcrypt.genSalt(rounds, function (err, salt) {  //솔트 문자열 생성하는데 default값이 10
                if (err) {
                    callback(err);
                } else {
                    callback(null, salt, connection);
                }
            });
        }
        //TODO: 2. hash password generation (암호화된 원본암호를 해쉬함수를 이용해서 암호화)
        function generateHashPassword (salt, connection, callback) {
                bcrypt.hash(password, salt, function (err, hashPassword) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, hashPassword, connection);
                    }
                });

        }

        function insertCustomer (hashPassword, connection, callback) {
            var sql1 = "INSERT INTO customer (email, customer_phone, customer_name, customer_acc_pwd) " +
                       "VALUES (?, ?, ?, ?)";

            connection.query(sql1, [email, phone, name, hashPassword], function (err, result) {
               connection.release();
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
        }

        async.waterfall([getConnection, selectCustomer, generateSalt, generateHashPassword, insertCustomer], function (err, result) {
            if (err) {
                var err = new Error('회원가입에 실패하였습니다.');
                err.status = 401;
                err.code = "E0001";
                next(err);
            } else {
                var results = {
                    "results": {
                        "message": "회원 가입이 정상적으로 처리되었습니다."
                    }
                };
                res.json(results);
            }
        });
    } else {
        var err = new Error('SSL/TLS Ugrades Required');
        err.status = 426;
        next(err);
    }
});


module.exports = router;
//// TODO: 회원정보 확인하기(/customers/me HTTPS GET)
//
//// TODO: 회원정보 변경하기 (/customers/me HTTPS PUT)
//
//// TODO: 회원 탈퇴하기 (/customers HTTP DELETE)
