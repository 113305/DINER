// TODO: 레스토랑 검색하기 (/restaurants HTTP get)

var express = require('express');
var async = require('async');
var bcrypt = require('bcrypt');
var router = express.Router();

router.get('/', function (req, res, next) {

    var restaurants = req.query.restaurantName;

    function getConnection(callback) {
        pool.getConnection(function (err, connection) {
            if (err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function selectRestaurant (connection, callback) {
        var sql = "SELECT id, restaurant_name, address, website_url, business_hours, " +
            "       reward_photo_url, reward_name, reward_info, " +
            "       take_out, parking, smoking, break_time, discount_info, avg_score, " +
            "       restaurant_phone, restaurant_info, dong_info, restaurant_class, price_range, " +
            "FROM restaurant " +
            "WHERE restaurant_name = ?";

        var restaurantId = [];
        var data = {};
        connection.query(sql, [restaurants], function (err, results) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                for (var i = 0; i < results.length; i++) {
                    restaurantId.append(results[i].id);
                    data[i] = {
                        "list_restaurant": {
                            "restaurant_name": results[0].restaurant_name,
                            "restaurant_photo_url": results[0].restaurant_photo_url,
                            "dong_info": results[0].dong_info,
                            "restaurant_class": results[0].restaurant_class
                        },
                        "detail_restaurant": {
                            "restaurant_name": resutls[0].restaurant_name,
                            "address": results[0].address,
                            "website_url": results[0].website_url,
                            "price_range": results[0].price_range,
                            "reward_photo_url": results[0].reward_photo_url,
                            "reward_info": results[0].reward_info,
                            "reward_name": results[0].reward_name,
                            "take_out": results[0].take_out,
                            "parking": results[0].parking,
                            "smoking": results[0].smoking,
                            "break_time": results[0].break_time,
                            "avg_score": results[0].avg_score,
                            "restaurant_info": results[0].restaurant_info,
                            "restaurant_photo_url": [],
                            "menu": []
                        }
                    };
                }
                callback(null, data);
            }
        });
    }

    function getMenu (data, callback) {
        for (var j = 0; j < restaurantId.length; j++) {  // 메뉴배열
            var sql1 = "SELECT * " +
                "FROM menu " +
                "WHERE restaurant_id =?";
            connection.query(sql1, [restaurantId[j]], function (err, results) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    data[j].detail_restaurant.menu = results;
                    callback(null, data);
                }
            });
        }
    }

    function getRestPhotoUrl (data, callback) {
        for (var k = 0; k < restaurantId.length; k++) {  // 메뉴배열
            var sql3 = "SELECT * " +
                "FROM restaurant_photo " +
                "WHERE restaurant_id = ?";
            connection.query(sql3, [restaurantId[k]], function (err, results) {
                connection.release();
                if (err) {
                    callback(err);
                } else {
                    data[k].detail_restaurant.restaurant_photo_url = results;
                    callback(null, data);
                }
            });
        }
    }


    async.waterfall([getConnection, selectRestaurant, getMenu, getRestPhotoUrl], function (err, data) {
        if (err) {
            var err = new Error('레스토랑 조회에 실패하였습니다.');
            err.status = 401;
            err.code = "E0011";
            next(err);
        } else {
            var result = {
                "results": {
                    "message": "레스토랑 조회가 정상적으로 처리되었습니다.",
                    "data": data
                }
            };
            res.json(result);
        }
    });
});

module.exports = router;