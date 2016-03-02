var express = require('express');
var bcrypt = require('bcrypt');
var async = require('async');
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

router.route('/:restaurantId/reserve')
    .post(isLoggedIn, function(req, res, next) {
        var customer = req.user;

        var restaurantId = req.params.restaurantId;
        var dateTime = req.body.dateTime;
        var adultNumber = req.body.adultNumber;
        var childNumber = req.body.childNumber;
        var etcRequest = req.body.etcRequest;
        var quantity = req.body.quantity;
        var menuName = req.body.menuName;

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
               if (err) {
                   callback(err);
               } else {
                   callback(null, connection);
               }
            });
        }

        function insertReservation (connection, callback) {
            var sql = "INSERT INTO reservation(customer_id, restaurant_id, date_time, adult_number, " +
                      "            child_number, etc_request, " +
                      "            state) " +
                      "VALUES (?, ?, ?, ?, ?, ?, default)";
            connection.query(sql, [customer.id, restaurantId, dateTime, adultNumber, childNumber, etcRequest], function (err, result) {
                connection.release();
                if (err) {
                    callback(err);
                } else {
                    console.log('결과', result);
                    callback(null, result);
                }
            })
        }

        async.waterfall([getConnection, insertReservation], function(err, result) {
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
    })

    // show 확인하기 (QR) (/reservations HTTP GET)
    .get(function(req, res, next) {
        var restaurantName = req.query.name;
        var customerId = req.user.id;

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

            connection.query(select, [restaurantName, customerId], function(err, results) {
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
                         "WHERE restaurant_id = ? and state='완료'";

            connection.query(select, [restaurantId], function(err, results) {
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
    .post(function(req, res, next) {
        var reservationId = req.params.reservationId;
        var score = req.body.score;

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            });
        }

        function selectCustomerId (connection, callback) {
            var select = "SELECT customer_id " +
                "FROM reservation " +
                "WHERE reservation_id = ?";

            connection.query(select, [reservationId], function(err, results) {

                if (err) {
                    callback(err);
                } else {
                    var customer = {
                        "id": results[0].customer_id
                    };
                    callback(null, connection, customer);
                }
            });
        }

        function selectCustomerShowCount (connection, customer, callback) {
            var select = "SELECT show_count " +
                "FROM customer " +
                "WHERE customer_id = ?";

            connection.query(select, [customer.id], function(err, results) {
                if (err) {
                    callback(err);
                } else {
                    customer.showCount = results[0].show_count;
                    callback(null, connection, customer);
                }
            });
        }


        function updateShowCount(connection, customer, callback) {
            var newShowCount = customer.showCount + 1;
            var update = "UPDATE customer " +
                         "SET	show_count = ?, score = ? " +
                         "WHERE customer_id= ?";

            connection.query(update, [newShowCount, score, customer.id], function(err , result) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
        }

        async.waterfall([getConnection, selectCustomerId, selectCustomerShowCount, updateShowCount], function(err) {
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

    });


module.exports = router;

