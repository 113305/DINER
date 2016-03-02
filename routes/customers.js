
var express = require('express');
var bcrypt = require('bcrypt');
var async = require('async');
var hexkey = process.env.DINER_HEX_KEY;

var router = express.Router();

function isLoggedIn(req, res, next) { // 로그인 성공 여부 확인
    if (!req.isAuthenticated()) {
        var err = new Error('로그인이 필요합니다...');
        err.status = 401;
        next(err);
    } else {
        next();  // 성공시 요청 처리
    }
}

// TODO: 회원가입하기(/customer HTTPS POST)
router.post('/', function (req, res, next) {
    if (req.secure) {
        var name = req.body.name;
        var password = req.body.password;
        var phone = req.body.phone;
        var email = req.body.email;

        function getConnection(callback) {
            pool.getConnection(function (err, connection) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            });
        }

        function selectCustomer(connection, callback) {
            var sql = "SELECT customer_id " +
                "FROM customer " +
                "WHERE email = aes_encrypt(" + connection.escape(email) + ", unhex(" + connection.escape(hexkey) + "))";
            connection.query(sql, function (err, results) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    if (results.length) {
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
        function generateSalt(connection, callback) {
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
        function generateHashPassword(salt, connection, callback) {
            bcrypt.hash(password, salt, function (err, hashPassword) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, hashPassword, connection);
                }
            });

        }

        function insertCustomer(hashPassword, connection, callback) {
            var sql1 = "INSERT INTO customer(email, customer_name, customer_phone, customer_acc_pwd) " +
                "VALUES (aes_encrypt(" + connection.escape(email) + ", unhex(" + connection.escape(hexkey) + ")), " +
                "        aes_encrypt(" + connection.escape(name) + ", unhex(" + connection.escape(hexkey) + ")), " +
                "        aes_encrypt(" + connection.escape(phone) + ", unhex(" + connection.escape(hexkey) + ")), " +
                         connection.escape(hashPassword) + ")";

            connection.query(sql1, function (err, result) {
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
                err.code = "E0001b";
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

// TODO: 회원 탈퇴하기 (/customers HTTP DELETE)
router.delete('/', isLoggedIn, function (req, res, next) {
    var customer = req.user;

    function getConnection(callback) {
        pool.getConnection(function (err, connection) {
            if (err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function selectReservation (connection, callback) {
        var sql = "SELECT reservation_id " +
                  "FROM reservation " +
                  "WHERE customer_id = ?";
        connection.query(sql, [customer.id], function (err, result) {
           if (err) {
               callback(err);
           } else {
               callback(null, connection, result);
           }
        });
    }

    function deleteReservation (connection, result, callback) {
        var sql = "DELETE " +
                  "FROM reservation " +
                  "WHERE reservation_id in (?)";

        connection.query(sql, [result], function (err, result) {
           if (err) {
               callback(err);
           } else {
               callback(null, connection, result)
           }
        });
    }

    function deleteCustomer(connection, result, callback) {
        var sql2 = "DELETE " +
            "FROM customer " +
            "WHERE customer_id = ?";
        connection.query(sql2, [customer.id], function (err, result) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                callback(null);
            }
        });
    }

    async.waterfall([getConnection, selectReservation, deleteReservation, deleteCustomer], function (err, result) {
        if (err) {
            var err = new Error('회원탈퇴에 실패하였습니다.');
            err.status = 401;
            err.code = "E00011b";
            next(err);
        } else {
            var results = {
                "results": {
                    "message": "회원 탈퇴가 정상적으로 처리되었습니다."
                }
            };
            res.json(results);
        }
    });

});

// TODO: 회원정보 확인하기(/customers/me HTTPS GET)
router.get('/me', isLoggedIn, function (req, res, next) {  // 내 정보 요청

    var customer = req.user;  // 세션에저장된 user정보 id, name, phone, email, password, facebookEnail, facebookName
    var result = {};

    function getConnection(callback) {
        pool.getConnection(function (err, connection) {
            if (err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function getCustomer(connection, callback) {  //페북으로 가입한사람이랑 로컬가입한사람이랑 어떻게 보여주지? 

        //if (!req.session.facebookName === null)  //페이스북회원
        //{
        //
        //} else { // 로컬회원
        //
        //}
        var sql = "SELECT show_count " +
                  "FROM customer " +
                  "WHERE customer_id = ?";

        connection.query(sql, [customer.id], function (err, result) {
            if (err) {
                connection.release();
               callback(err);
           } else {
                result = {
                    "profile": {
                        "email": customer.email,
                        "phone": customer.phone,
                        "name": customer.name,
                        "showCount": result[0].show_count
                    }
                };
                console.log('리절트1', result);
                callback(null, connection, result);
            }
        });
    }

    function getReservation (connection, result, callback) {
        var sql = "select reservation_id, restaurant_name, date_time, adult_number, child_number, etc_request "+
        "from reservation res join restaurant r on (res.restaurant_id = r.restaurant_id) "+
        "where customer_id = ?";

        connection.query(sql, [customer.id], function (err, results) {
            if(err) {
                connection.release();
                callback(err);
            } else {
                var reservationId = results[0].reservation_id;
                result.reservation = {
                    "restaurant_name": results[0].restaurant_name,
                    "date_time": results[0].date_time,
                    "adult_number": results[0].adult_number,
                    "child_number": results[0].child_number,
                    "etc_request": results[0].etc_request,
                    "menu": []
                };
                console.log('리절트2', result);
                callback(null, connection, result, reservationId);
            }
        });
    }

    function selectReservationMenu (connection, result, reservationId, callback) {
        var sql = "select menu_name, quantity " +
        "from menu_reservation mr join menu m on (mr.menu_id = m.menu_id) "+
        "where reservation_id = ?";

        connection.query(sql, [reservationId], function (err, results) {
           if (err) {
               callback(err);
           } else {
               async.eachSeries(results, function (menu, cb) {
                   result.reservation.menu.push({
                       "menu_name": menu.menu_name,
                       "quantity": menu.quantity
                   });
                   console.log('리절트3', result);
                   console.log('메뉴배열', results);
                   cb(null);
               }, function(err) {
                   if(err){
                       cb(err);
                   } else {
                       console.log('리졀트4', result);
                       callback(null, result);
                   }
               });
           }
        });

    }


    async.waterfall([getConnection, getCustomer, getReservation, selectReservationMenu], function (err, result) {
        console.log('리절트5', result);
        if (err) {
            var err = new Error('회원 정보 조회에 실패하였습니다.');
            err.status = 401;
            err.code = "E0003";
            next(err);
        } else {
            var results = {
                "results": {
                    "message": "회원의 정보 조회가 정상적으로 처리되었습니다.",
                    "data": result
                }
            };
            console.log('리절트5', result);
            res.json(results);
        }
    });
});


//// TODO: 회원정보 변경하기 (/customers/me HTTPS PUT)
router.put('/', isLoggedIn, function (req, res, next) {
    var customer = req.user;

    var name = req.body.name;
    var password = req.body.password;
    var phone = req.body.phone;

    function getConnection(callback) {
        pool.getConnection(function (err, connection) {
            if (err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function updateCustomer(connection, callback) {
        var sql = "UPDATE customer " +
            "SET aes_encrypt(" + connection.escape(name) + ", unhex(" + connection.escape(hexkey) + ")), " +
            "    aes_encrypt(" + connection.escape(phone) + ", unhex(" + connection.escape(hexkey) + ")), " +
            "    aes_encrypt(" + connection.escape(password) + ", unhex(" + connection.escape(hexkey) + ")) " +
            "WHERE customer_id = " + connection.escape(customer.id);
        connection.query(sql, function (err, result) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                console.log('변경정보', result);
                callback(null);
            }
        });
    }
    async.waterfall([getConnection, updateCustomer], function (err) {
        if (err) {
            var err = new Error('회원정보 변경에 실패하였습니다.');
            err.status = 401;
            err.code = "E0004";
            next(err);
        } else {
            var results = {
                "results": {
                    "message": "회원 정보 변경이 정상적으로 처리되었습니다."
                }
            };
            res.json(results);
        }
    });

});

module.exports = router;
