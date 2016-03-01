var express = require('express');
var bcrypt = require('bcrypt');
var async = require('async');
var router = express.Router();



// TODO: 예약하기 (/reservations HTTP POST)
router.route('/')
    //.post(function(req, res, next) {
    //    var dateTime = req.body.dateTime;
    //    var adultNumber = req.body.adultNumber;
    //    var childNumber = req.body.childNumber;
    //    var etcRequest = req.body.etcRequest;
    //    var quantity = req.body.quantity;
    //    var menuName = req.body.menuName;
    //
    //    function getConnection(callback) {
    //        pool.getConnection(function(err, connection) {
    //           if (err) {
    //               callback(err);
    //           } else {
    //               callback(null, connection);
    //           }
    //        });
    //    }
    //
    //    async.waterfall([getConnection], function(err, result) {
    //       if (err) {
    //           next(err);
    //       } else {
    //           req.json(result);
    //       }
    //    });
    //})

    // show 확인하기 (QR) (/reservations HTTP GET)
    .get(function(req, res, next) {
        var restaurantName = req.query.name;
        var customerId = req.session.id;

        function getConnection(callback) {
            pool.getConnection(function (err, connection) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            });
        }

        function selectReservationId(connection, callback) {
            var select = "SELECT reser.id as id " +
                         "FROM reservation reser join (SELECT id, restaurant_name " +
                         "                             FROM restaurant) resto " +
                         "                       on (reser.restaurant_id = resto.id) " +
                         "WHERE resto.restaurant_name = ? and reser.customer_id = ? and reser.state = '완료' and date(reser.date_time) = date(now())";
            connection.query(select, [restaurantName, customerId], function(err, results) {
                connection.release();
                if (err) {
                   callback(err);
               } else {
                   var reservation = {
                       "id": results[0].id
                   };
                   callback(null, reservation);
               }
            });
        }


        async.waterfall([getConnection, selectReservationId], function(err, reservation) {
           if (err) {
               var err = new Error('예약 정보 조회에 실패하였습니다.');
               err.code = 'E0007';
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

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            });
        }

        function selectCustomer (connection, callback) {
            var select = "SELECT c.id as id, c.show_count as showCount " +
                         "FROM reservation r join (SELECT id, show_count " +
                         "                         FROM customer) c " +
                         "                   on (r.customer_id = c.id) " +
                         "WHERE r.id = ?";

            connection.query(select, [reservationId], function(err, results) {
               if (err) {
                   callback(err);
               } else {
                   var customer = {
                       "id": results[0].id,
                       "showCount": results[0].showCount
                   };
                   callback(null, connection, customer);
               }
            });
        }


        function updateShowCount(connection, customer, callback) {
            var newShowCount = customer.showCount + 1;
            var update = "UPDATE customer " +
                         "SET	show_count = ? " +
                         "WHERE id= ?";

            connection.query(update, [newShowCount, customer.id], function(err , result) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });
        }

        async.waterfall([getConnection, selectCustomer, updateShowCount], function(err) {
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

