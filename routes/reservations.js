var express = require('express');
var bcrypt = require('bcrypt');
var async = require('async');
var moment = require('moment-timezone');
var request = require('request');
var router = express.Router();

var logger = require('../config/loggerconfig');


// 예약하기 (/reservations HTTP POST) noshowpro계산해서 넣기

function isLoggedIn(req, res, next) { // 로그인 성공 여부 확인
    if (!req.isAuthenticated()) {
        var err = new Error('로그인이 필요합니다...');
        err.status = 401;
        next(err);
    } else {
        next();  // 성공시 요청 처리
    }
}

router.post('/:restaurantId/reserve/:pReservationId', isLoggedIn, function(req, res, next) {

    var customer = req.user;

    var restaurantId = req.params.restaurantId;
    var pReservationId = parseInt(req.params.pReservationId);
    var reservationState = parseInt(req.body.reservationState);

    var adultNumber = req.body.adultNumber;
    var childNumber = req.body.childNumber;
    var etcRequest = req.body.etcRequest;
    var orderLists = req.body.orderLists;

    logger.log('info', 'orderLists' + orderLists);
    logger.log('info', 'request' + req.body);
    logger.log('info', 'request' + req);


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
        var sql = "SELECT floor(100 -((show_count / count(reservation_state))) * 100) as noShowPro "+
                  "FROM customer c join reservation r on (c.customer_id = r.customer_id)" +
                  "WHERE c.customer_id = ? and reservation_state = 1";

        connection.query(sql, [customer.customerId], function (err, results) {
           if (err) {
               connection.release();
               callback(err);
           } else {
               var noShowPro = results[0].noShowPro;
               callback(null, connection, noShowPro);
           }
        });
    }

    function insertReservation (connection, noShowPro, callback) {

        connection.beginTransaction(function (err) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                function updateReservationTable ( cb1) {
                    if (pReservationId === 0) {   // reservation_state = 0(디폴트)
                        var sql = "INSERT INTO reservation(customer_id, restaurant_id, no_show_pro, date_time, before_60m, before_35m, adult_number, child_number, etc_request, reservation_state) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

                        connection.query(sql, [customer.customerId, restaurantId, noShowPro, dateTime, before_60m, before_35m, adultNumber, childNumber, etcRequest, reservationState], function (err, result) {
                            if (err) {
                                connection.rollback();
                                connection.release();
                                cb1(err);
                            } else {
                                var reservationId = result.insertId;
                                cb1(null, reservationId);
                            }
                        });
                    } else {
                        // 취소일땐                        상태만 2로 바꿔줌
                        var sql = "UPDATE reservation " +
                            "SET date_time = ?, before_60m = ?, before_35m = ?, adult_number= ?, child_number =?, etc_request =?, " +
                            "reservation_state = ? " +
                            "WHERE reservation_id = ?";

                        connection.query(sql, [dateTime, before_60m, before_35m, adultNumber, childNumber, etcRequest, reservationState, pReservationId], function (err, result) {
                            if (err) {
                                connection.rollback();
                                connection.release();
                                cb1(err);
                            } else {
                                var reservationId = pReservationId;
                                cb1(null, reservationId);
                            }
                        });
                    }
                }

                function insertMenuReservation (reservationId, cb1) {

                    if(!(pReservationId === 0)) {
                        // 만약 메뉴 예약 정보가 존재하면 delete 하고 다시 입력받음
                        var sql = "DELETE " +
                                  "FROM menu_reservation " +
                                  "WHERE reservation_id = ?";

                        connection.query(sql, [reservationId], function (err) {
                            if (err) {
                                cb1(err);
                            } else {
                                cb1(null);
                            }
                        });
                    }

                    if (orderLists instanceof Array)  {
                        async.eachSeries(orderLists, function (orderList, cb2) {
                            var order = orderList.split(",");

                            var menuName = order[0];
                            var quantity = order[1];

                            logger.log('info', 'menuName' + menuName);
                            logger.log('info', 'quantity' + quantity);

                            function selectMenuId (cb3) {
                                var sql = "SELECT menu_id " +
                                          "FROM menu "+
                                          "WHERE menu_name = ?";
                                connection.query(sql, [menuName], function (err, results) {
                                    if (err) {
                                        connection.release();
                                        cb3(err);
                                    } else {
                                        var menuId = results[0].menu_id;
                                        cb3(null, menuId);
                                    }
                                });
                            }

                            function insertMenuReserveTable (menuId, cb3) {
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
                            if (err) {
                                cb1(err);
                            } else {
                                cb1(null, reservationId);
                            }
                        });

                    } else {
                        var order = orderLists.split(",");
                            var menuName = order[0];
                            var quantity = order[1];

                        logger.log('info', 'menuName' + menuName);
                        logger.log('info', 'quantity' + quantity);
                        function selectMenuId (cb2) {
                            var sql = "SELECT menu_id " +
                                    "FROM menu "+
                                    "WHERE menu_name = ?";
                            connection.query(sql, [menuName], function (err, results) {
                                if (err) {
                                    connection.release();
                                    cb2(err);
                                } else {
                                    var menuId = results[0].menu_id;
                                    cb2(null, menuId);
                                }
                            });
                        }

                        function insertMenuReserveTable (menuId, cb2) {
                            var sql = "INSERT INTO menu_reservation (menu_id, reservation_id, quantity) " +
                                      "VALUES (?, ?, ?) ";
                            connection.query(sql, [menuId, reservationId, quantity], function (err, result) {
                                if (err) {
                                    connection.rollback();
                                    connection.release();
                                    cb2(err);
                                } else {
                                    cb2(null, result);
                                }
                            })
                        }


                        async.waterfall([selectMenuId, insertMenuReserveTable], function (err, result) {
                            if (err) {
                                connection.release();
                                cb1(err);
                            } else {
                                cb1(null, reservationId);
                            }
                        });


                    }
                }

                async.waterfall([updateReservationTable, insertMenuReservation], function (err, reservationId) {
                    if (err) {
                        callback(err);
                    } else {
                        connection.commit();
                        connection.release();
                        callback(null, reservationId);
                    }
                });
            }

        });
    }

    async.waterfall([getConnection, getNoshowPro, insertReservation], function(err, reservationId) {
       if (err) {
           if (reservationState === 0) {
               var err = new Error('예약에 실패하였습니다.');
               err.code = "E0013a";
           } else if (reservationState === 2) {
               var err = new Error('예약 취소에 실패하였습니다.');
               err.code = "E0013b";
           } else if (reservationState ===3) {
               var err = new Error('예약정보 변경에 실패하였습니다.');
               err.code = "E0013c";
           }

           next(err);
       } else {
           if (reservationState === 0) {
               var result = {
                   "results": {
                       "message": "예약이 정상적으로 처리되었습니다."
                   }
               };
           } else if (reservationState === 2) {
               var result = {
                   "results": {
                       "message": "예약이 취소되었습니다."
                   }
               };
           } else if (reservationState === 3) {
               var result = {
                   "results": {
                       "message": "예약정보가 변경되었습니다."
                   }
               };
           }

           var url = 'http://localhost/admin/' + reservationId;
           request.get({
               "url": url
           }, function (error, response, body) {
               res.json(result);
           });

       }
    });
});


// show 확인하기 (QR) (/reservations HTTP GET)
router.get('/', isLoggedIn, function(req, res, next) {
    var restaurantName = req.query.restaurantName;
    var customerId = req.user.customerId;

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
                     "WHERE restaurant_id = ? and customer_id = ? and reservation_state = 1 and date(date_time) = ?";

        var m = moment().tz('Asia/Seoul');
        var todayDate = m.format("YYYY-MM-DD");

        connection.query(select, [restaurantId, customerId, todayDate], function(err, results) {
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
                                var newShowCount = results[0].show_count + 1;
                                cb(null, newShowCount);
                            }
                        });
                    }

                    function updateShowCount(newShowCount, cb) {
                        var update = "UPDATE customer " +
                            "SET	show_count = ? " +
                            "WHERE customer_id= ?";

                        connection.query(update, [newShowCount, customer.customerId], function(err , result) {
                            if (err) {
                                connection.rollback();
                                cb(err);
                            } else {
                                cb(null);
                            }
                        });
                    }


                    async.waterfall([updateScore, selectCustomerShowCount, updateShowCount], function(err, results) {
                        if (err) {
                            var err = new Error('show count 업데이트에 실패하였습니다.');
                            err.code = 'E0008a';
                            callback(err);
                        } else {
                            connection.commit();
                            callback(null, connection);
                        }
                    });
                }
            });
        }

        function updateAvgScore(connection, callback) {
            connection.beginTransaction(function(err) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    function selectUpdateInfo(cb) {
                        var select = "SELECT restaurant_id, sum(score) as score, count(score) as count " +
                            "FROM reservation " +
                            "WHERE reservation_state = 1 and restaurant_id = (SELECT restaurant_id " +
                            "                                                 FROM reservation " +
                            "                                                 WHERE reservation_id = ?)";

                        connection.query(select, [reservationId], function(err, results) {
                            if (err) {
                                connection.rollback();
                                connection.release();
                                cb(err);
                            } else {
                                var newAvgScore = parseInt(results[0].score)/parseInt(results[0].count)
                                var updateInfo = {
                                    "restaurant_id": results[0].restaurant_id,
                                    "newAvgScore": newAvgScore
                                };
                                cb(null, updateInfo)
                            }
                        });
                    }

                    function updateAvgScore(updateInfo, cb) {
                        var update = "UPDATE restaurant " +
                            "SET avg_score = ROUND(?, 2) " +
                            "WHERE restaurant_id = ?";

                        connection.query(update, [updateInfo.newAvgScore, updateInfo.restaurant_id], function(err, result) {
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

                    async.waterfall([selectUpdateInfo, updateAvgScore], function(err, results) {
                        if (err) {
                            var err = new Error('평균 별점 업데이트에 실패했습니다.');
                            err.code = 'E0008b';
                            callback(err);
                        } else {
                            callback(null);
                        }
                    });
                }
            });

        }



        async.waterfall([getConnection, showCheck, updateAvgScore], function(err) {
           if (err) {
               next(err);
           } else {
               var results = {
                   "message": "show 확인이 정상적으로 처리되었습니다."
               };
               res.json(results);
           }
        });
    });


module.exports = router;

