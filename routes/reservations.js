var express = require('express');
var bcrypt = require('bcrypt');
var async = require('async');
var moment = require('moment-timezone');
var router = express.Router();



// TODO: 예약하기 (/reservations HTTP POST) noshowpro계산해서 넣기

function isLoggedIn(req, res, next) { // 로그인 성공 여부 확인
    if (!req.isAuthenticated()) {
        var err = new Error('로그인이 필요합니다...');
        err.status = 401;
        next(err);
    } else {
        next();  // 성공시 요청 처리
    }
}

router.post('/:restaurantId/reserve', isLoggedIn, function(req, res, next) {

    var customer = req.user;

    var restaurantId = req.params.restaurantId;
    var adultNumber = req.body.adultNumber;
    var childNumber = req.body.childNumber;
    var etcRequest = req.body.etcRequest;
    var orderLists = req.body.orderLists;


    var year = parseInt(req.body.year);
    var month = parseInt(req.body.month) - 1;
    var day = parseInt(req.body.day);
    var hour = parseInt(req.body.hour);
    var minute = parseInt(req.body.minute);

    //원래 데이트타임
    var m = moment({"year": year, "month": month, "day": day,
        "hour": hour, "minute": minute, "second": "00"}).tz('Asia/Seoul');

    var dateTime = m.format("YYYY-MM-DD HH:mm:00");

    //60분전 데이트타임
    var hour2 = hour -1;
    var m2 = moment({"year": year, "month": month, "day": day,
        "hour": hour2, "minute": minute, "second": "00"}).tz('Asia/Seoul');

    var before_60m = m2.format("YYYY-MM-DD HH:mm:00");

    var minute2 = minute - 35;
    var minute3 = 60 - (35 - minute);

    //35분전
    if (minute >= 35) {  //예약 분이 35분보다 클때
        var m3 = moment({"year": year, "month": month, "day": day,
            "hour": hour, "minute": minute2, "second": "00"}).tz('Asia/Seoul');

        var before_35m = m3.format("YYYY-MM-DD HH:mm:00");
    } else {
        var m3 = moment({"year": year, "month": month, "day": day,
            "hour": hour2, "minute": minute3, "second": "00"}).tz('Asia/Seoul');

        var before_35m = m3.format("YYYY-MM-DD HH:mm:00");
    }

    //console.log('메뉴이름', menuName);
    function getConnection(callback) {
        pool.getConnection(function(err, connection) {
           if (err) {
               callback(err);
           } else {
               callback(null, connection);
           }
        });
    }

    function getNoshowPro (connection, callback) {
        var sql = "select floor(100 -((show_count / count(reservation_state))) * 100) as noShowPro "+
        "from customer c join reservation r on (c.customer_id = r.customer_id)" +
        "where c.customer_id = ? and reservation_state = 1";

        connection.query(sql, [customer.customerId], function (err, results) {
           if (err) {
               connection.release();
               callback(err);
           } else {
               var noShowPro = results[0].noShowPro;
               console.log('노쇼확률', noShowPro);
               callback(null, connection, noShowPro);
           }
        });
    }

    function getDateTime (connection, noShowPro, callback) {
        var sql = "SELECT date_time " +
                  "FROM reservation " +
                  "WHERE reservation_id = ?;"
    }


    function insertReservation (connection, noShowPro, callback) {
        console.log('노쇼확률', noShowPro);
        var reservationId = 0;
        connection.beginTransaction(function (err) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                function insertReservationTable (cb1) {
                    var sql = "INSERT INTO reservation(customer_id, restaurant_id, no_show_pro, date_time, before_60m, before_35m, adult_number, child_number, etc_request) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                    connection.query(sql, [customer.customerId, restaurantId, noShowPro, dateTime, before_60m, before_35m, adultNumber, childNumber, etcRequest], function (err, result) {
                        if (err) {
                            connection.rollback();
                            connection.release();
                            cb1(err);
                        } else {
                            reservationId = result.insertId;
                            cb1(null);
                        }
                    })
                }

                function insertMenuReservation (cb1) {

                    async.eachSeries(orderLists, function (orderList, cb2) {
                        var order = orderList.split(",");

                        var menuName = order[0];
                        var quantity = order[1];

                        function selectMenuId (cb3) {
                            var sql = "select menu_id " +
                                "from menu "+
                                "where menu_name = ?";
                            connection.query(sql, [menuName], function (err, results) {
                                if (err) {
                                    connection.release();
                                    cb3(err);
                                } else {
                                    var menuId = results[0].menu_id;
                                    console.log('메뉴아이디', menuId);
                                    cb3(null, menuId);
                                }
                            });
                        }

                        function insertMenuReserveTable (menuId, cb3) {
                            console.log('메뉴아이디', menuId);
                            var sql = "INSERT INTO menu_reservation (menu_id, reservation_id, quantity) " +
                                "VALUES (?, ?, ?)";
                            connection.query(sql, [menuId, reservationId, quantity], function (err, result) {
                                if (err) {
                                    connection.rollback();
                                    connection.release();
                                    cb3(err);
                                } else {
                                    cb3(null);
                                }
                            })
                        }

                        async.waterfall([selectMenuId, insertMenuReserveTable], function (err) {
                            if (err) {
                                cb2(err);
                            } else {
                                cb2(null);
                            }
                        });

                    }, function (err) {
                        cb1(err);
                    });
                }

                async.series([insertReservationTable, insertMenuReservation], function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        connection.commit();
                        connection.release();
                        callback(null);
                    }
                });
            }
        });
    }

    async.waterfall([getConnection, getNoshowPro, insertReservation], function(err) {
       if (err) {
           var err = new Error('예약에 실패하였습니다.');
           err.code = "E0013";
           next(err);
       } else {
           var results = {
               "results": {
                   "message": "예약이 정상적으로 처리되었습니다."
               }
           };
           res.json(results);
       }
    });
});


// show 확인하기 (QR) (/reservations HTTP GET)
router.get('/', isLoggedIn, function(req, res, next) {
    var restaurantName = req.query.restaurantName;
    var customerId = req.user.customerId;

    console.log(restaurantName);
    function getConnection(callback) {
        pool.getConnection(function (err, connection) {
            if (err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function selectRestaurantId(connection, callback) {
        var select = "SELECT restaurant_id " +
            "         FROM restaurant " +
            "         WHERE restaurant_name = ?";

        connection.query(select, [restaurantName], function(err, results) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                if (results.length === 0) {
                    var err = new Error('레스토랑 정보 조회에 실패하였습니다.');
                    err.code = 'E0007a';
                    callback(err);
                } else {
                    var restaurantId = results[0].restaurant_id;
                    callback(null, connection, restaurantId);
                }
            }
        });
    }

    function selectReservationId(connection, restaurantId, callback) {
        var select = "SELECT reservation_id " +
                     "FROM reservation " +
                     "WHERE restaurant_id = ? and customer_id = ? and reservation_state=1 and date(date_time) = date(now())";

        connection.query(select, [restaurantId, customerId], function(err, results) {
            connection.release();
            if (err) {
               callback(err);
            } else {
                if (results.length === 0) {
                    var err = new Error('예약 정보 조회에 실패하였습니다.');
                    err.code = 'E0007b';
                    callback(err);
                } else {
                    var reservation = {
                        "id": results[0].reservation_id
                    };
                    callback(null, reservation);
                }
            }
        });
    }

    async.waterfall([getConnection, selectRestaurantId, selectReservationId], function(err, reservation) {
       if (err) {
           next(err);
       } else {
           var result = {
               "results": {
                   "message": "예약 정보 조회가 정상적으로 처리 되었습니다.",
                   "data": {
                       "reservationId": reservation.id
                   }
               }
           };
           res.json(result);
       }
    });

});

router.route('/:reservationId')
    //show 확인하기 (check) (/reservations/:reservationId HTTP POST)
    .post(isLoggedIn, function(req, res, next) {
        var reservationId = req.params.reservationId;
        var score = req.body.score;
        var customer = req.user;
        var newShowCount = 0;
        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            });
        }

        function showCheck (connection, callback) {
            connection.beginTransaction(function(err) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    function updateScore (cb) {
                        var update = "UPDATE reservation " +
                                     "SET	score = ? " +
                                     "WHERE customer_id = ? and reservation_id = ?";

                        connection.query(update, [score, customer.customerId, reservationId], function(err, results) {
                            if (err) {
                                connection.rollback();
                                connection.release();
                                cb(err);
                            } else {
                                cb(null);
                            }
                        });
                    }

                    function selectCustomerShowCount (cb) {
                        var select = "SELECT show_count " +
                            "FROM customer " +
                            "WHERE customer_id = ?";

                        connection.query(select, [customer.customerId], function(err, results) {
                            if (err) {
                                connection.rollback();
                                connection.release();
                                cb(err);
                            } else {
                                newShowCount = results[0].show_count + 1;
                                cb(null);
                            }
                        });
                    }

                    function updateShowCount(cb) {
                        var update = "UPDATE customer " +
                            "SET	show_count = ? " +
                            "WHERE customer_id= ?";

                        connection.query(update, [newShowCount, customer.customerId], function(err , result) {
                            if (err) {
                                connection.rollback();
                                connection.release();
                                cb(err);
                            } else {
                                connection.commit();
                                connection.release();
                                cb(null);
                            }
                        });
                    }

                    async.series([updateScore, selectCustomerShowCount, updateShowCount], function(err, results) {
                        if (err) {
                            callback(err);
                        } else {
                            callback(null);
                        }
                    });
                }
            });
        }



        async.waterfall([getConnection, showCheck], function(err) {
           if (err) {
               var err = new Error('show 확인에 실패하였습니다.');
               err.code = 'E0008';
               next(err);
           } else {
               var results = {
                   "message": "show 확인이 정상적으로 처리되었습니다."
               };
               res.json(results);
           }
        });
    })

    // TODO: 예약 변경/취소 (/reservations/:reservationId HTTP PUT)
    .put (function(req, res, next) {

        //예약 정보 변경사항 바디에 입력받기
        // dateTime, adultNumber, childNumber, e등등..

    });


module.exports = router;

