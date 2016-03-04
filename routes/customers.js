
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

// TODO: 회원가입하기(/customers HTTPS POST)
router.post('/', function (req, res, next) {
    if (req.secure) {
        var name = req.body.customerName;
        var password = req.body.password;
        var phone = req.body.customerPhone;
        var email = req.body.customerEmail;

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
                      "WHERE email = aes_encrypt(" + connection.escape(email) + ", unhex(" + connection.escape(hexkey) + ")) ";
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
                    console.log('솔트문자열', salt);
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
                    console.log('해쉬암호', hashPassword);
                    callback(null, hashPassword, connection);
                }
            });

        }

        function insertCustomer(hashPassword, connection, callback) {
            var sql1 = "INSERT INTO customer(email, customer_name, customer_phone, customer_acc_pwd) " +
                "VALUES (aes_encrypt(" + connection.escape(email) + ", unhex(" + connection.escape(hexkey) + ")), " +
                "        aes_encrypt(" + connection.escape(name) + ", unhex(" + connection.escape(hexkey) + ")), " +
                "        aes_encrypt(" + connection.escape(phone) + ", unhex(" + connection.escape(hexkey) + ")), " +
                         connection.escape(hashPassword) + ") ";

            connection.query(sql1, function (err, result) {
                connection.release();
                if (err) {
                    callback(err);
                } else {
                    console.log('회원가입결과', result);
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
// 바로 삭제하면 안되니까
// 상태를 만들어서 active: 0, 탈퇴요청: 1 (로그인안되게) 이런식으루

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

    function updateCustomerState(connection, callback) {
        var sql = "UPDATE customer " +
                  "SET customer_state = 1 " +
                  "WHERE customer_id = ?";

        connection.query(sql, [customer.customerId], function (err, results) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                callback(null)
            }
        });
    }

    //
    ////function selectReservation (connection, callback) {
    ////    var sql = "SELECT reservation_id " +
    //              "FROM reservation " +
    //              "WHERE customer_id = ?";
    //    connection.query(sql, [customer.id], function (err, result) {
    //       if (err) {
    //           callback(err);
    //       } else {
    //           callback(null, connection, result);
    //       }
    //    });
    //}
    //
    //function deleteReservation (connection, result, callback) {
    //    var sql = "DELETE " +
    //              "FROM reservation " +
    //              "WHERE reservation_id in (?)";
    //
    //    connection.query(sql, [result], function (err, result) {
    //       if (err) {
    //           callback(err);
    //       } else {
    //           callback(null, connection, result)
    //       }
    //    });
    //}
    //
    //function deleteCustomer(connection, result, callback) {
    //    var sql2 = "DELETE " +
    //        "FROM customer " +
    //        "WHERE customer_id = ?";
    //    connection.query(sql2, [customer.id], function (err, result) {
    //        connection.release();
    //        if (err) {
    //            callback(err);
    //        } else {
    //            callback(null);
    //        }
    //    });
    //}

    async.waterfall([getConnection, updateCustomerState], function (err, result) {
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

// TODO: 회원정보 확인하기(/customers/me HTTPS GET) showcount로 noshow카운트 계산하기 (전체 완료 예약건수 - showcount)
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

    function getCustomer(connection, callback) {
        var sql = "SELECT show_count " +
                  "FROM customer " +
                  "WHERE customer_id = ?";

        connection.query(sql, [customer.customerId], function (err, result) {
            if (err) {
                connection.release();
                callback(err);
           } else {
                result = {
                    "profile": {
                        "customerEmail": customer.customerEmail,
                        "customerName": customer.customerName,
                        "customerPhone": customer.customerPhone,
                        "showCount": result[0].show_count
                    },
                    "reservation": []
                };
                console.log('리절트1', result);
                callback(null, connection, result);
            }
        });
    }

    function getReservation (connection, result, callback) {
        var sql = "SELECT r.restaurant_id as restaurant_id, reservation_id, restaurant_name, date_time, adult_number, child_number, etc_request, score "+
                  "FROM reservation res join restaurant r on (r.restaurant_id = res.restaurant_id) "+
                  "WHERE customer_id = ? and reservation_state != 2";

        connection.query(sql, [customer.customerId], function (err, results) {
            if(err) {
                connection.release();
                callback(err);
            } else {
                    async.eachSeries(results, function (element, cb1) {
                        element.menu = [];

                        var sql1 = "SELECT menu_name, quantity " +
                            "FROM menu_reservation mr join menu m on (mr.menu_id = m.menu_id) "+
                            "WHERE reservation_id = ?";

                        connection.query(sql1, [element.reservation_id], function (err, results1) {
                            if (err) {
                                connection.release();
                                callback(err);
                            } else {
                                async.eachSeries(results1, function (menu, cb2) {
                                    element.menu.push({
                                        "menuName": menu.menu_name,
                                        "quantity": menu.quantity
                                    });
                                    cb2(null);
                                }, function(err) {
                                    if(err){
                                        cb2(err);
                                    } else {
                                        result.reservation.push({
                                            "restaurantId": element.restaurant_id,
                                            "restaurantName": element.restaurant_name,
                                            "dateTime": element.date_time,
                                            "adultNumber": element.adult_number,
                                            "childNumber": element.child_number,
                                            "etcRequest": element.etc_request,
                                            "menu": element.menu
                                        });
                                        cb1(null, result);
                                    }
                                });
                            }
                        });
                    }, function(err) {
                        if(err){
                            cb1(err);
                        } else {
                            console.log('리저트2', result);
                            callback(null, connection, result);
                        }
                    });
                //async.eachSeries(results, function (element, cb1) {
                //    element.menu = [];
                //
                //    var sql1 = "SELECT menu_name, quantity " +
                //               "FROM menu_reservation mr join menu m on (mr.menu_id = m.menu_id) "+
                //               "WHERE reservation_id = ?";
                //
                //    connection.query(sql1, [element.reservation_id], function (err, results1) {
                //        if (err) {
                //            connection.release();
                //            callback(err);
                //        } else {
                //            async.eachSeries(results1, function (menu, cb2) {
                //                element.menu.push({
                //                    "menuName": menu.menu_name,
                //                    "quantity": menu.quantity
                //                });
                //                cb2(null);
                //            }, function(err) {
                //                if(err){
                //                    cb2(err);
                //                } else {
                //                    result.reservation.push({
                //                        "restaurantId": element.restaurant_id,
                //                        "restaurantName": element.restaurant_name,
                //                        "dateTime": element.date_time,
                //                        "adultNumber": element.adult_number,
                //                        "childNumber": element.child_number,
                //                        "etcRequest": element.etc_request,
                //                        "menu": element.menu
                //                    });
                //                    cb1(null, result);
                //                }
                //            });
                //        }
                //    });
                //}, function(err) {
                //    if(err){
                //        cb1(err);
                //    } else {
                //        console.log('리저트2', result);
                //        callback(null, connection, result);
                //    }
                //});
            }
        });
    }

    function getPhoto(connection, result, callback) {
        async.eachSeries(result.reservation, function (item, cb) {
            var sql = "SELECT restaurant_photo_url " +
                      "FROM restaurant_photo " +
                      "WHERE restaurant_id = ? ";

            connection.query(sql, [item.restaurantId], function (err, results) {
               if (err) {
                   connection.release();
                   callback(err);
               } else {
                   item.photo = results[0].restaurant_photo_url;
                   cb(null);
               }
            });
        }, function (err) {
            if (err) {
                cb(err);
            } else {
                callback(null, result)
            }
        });
    }

    async.waterfall([getConnection, getCustomer, getReservation, getPhoto], function (err, result) {
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
            res.json(results);
        }
    });
});


//// TODO: 회원정보 변경하기 (/customers/me HTTPS PUT)  경우의수가 너무 많은데?? 바꿀때마다 다 바꾸긴 좀..
router.put('/me', isLoggedIn, function (req, res, next) {
    var customer = req.user;

    var name = req.body.customerName;
    var password = req.body.password;
    var phone = req.body.customerPhone;


    console.log('이름', name);
    function getConnection(callback) {
        console.log('이름11', name);
        pool.getConnection(function (err, connection) {
            if (err) {
                callback(err);
            } else {
                console.log('이름111', name);
                callback(null, connection);
            }
        });
    }


    //function changeCustomerInfo (connection, callback) {
    //    if (err) {
    //        callback(err);
    //    } else {
    //        if (name === null) {
    //                name = result.customerName;
    //        } else if (phone === null) {
    //            phone = result.customerPhone;
    //        } else if (password === null) {
    //            var err = new Error('비밀번호를 입력해주십시오');
    //            err.code = "E0004a";
    //            callback(err);
    //        } else {
    //            console.log('바디네임4',name);
    //            callback(null, name, result, connection);
    //        }
    //
    //    }
    //}

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


    function generateHashPassword(salt, connection, callback) {
        bcrypt.hash(password, salt, function (err, hashPassword) {
            if (err) {
                callback(err);
            } else {
                var password1 = hashPassword;
                callback(null, connection, password1);
            }
        });
    }


        function updateCustomer(connection, password1, callback) {
        var sql = "UPDATE customer " +
                  "SET customer_name = aes_encrypt(" + connection.escape(name) + ", unhex(" + connection.escape(hexkey) + ")), " +
                  "    customer_phone = aes_encrypt(" + connection.escape(phone) + ", unhex(" + connection.escape(hexkey) + ")), " +
                  "    customer_acc_pwd = " + connection.escape(password1) +
                  "WHERE customer_id = " + connection.escape(customer.customerId);
        connection.query(sql, function (err, results) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                callback(null);
            }
        });
    }

    async.waterfall([getConnection, generateSalt, generateHashPassword, updateCustomer], function (err) {
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
