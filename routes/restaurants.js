 // TODO: 레스토랑 검색하기 (전체에서 이름  검색) (/restaurants HTTP get)

var express = require('express');
var async = require('async');
var bcrypt = require('bcrypt');
var router = express.Router();

router.get('/', function (req, res, next) {

    var restaurantName = req.query.restautantName;

    function getConnection(callback) {
        pool.getConnection(function (err, connection) {
            if (err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function selectRestaurant(connection, callback) {
        //var datas = [];
        var select = "SELECT restaurant_id, restaurant_name, address, website_url, business_hours, " +
            "reward_photo_url, reward_name, reward_info, " +
            "take_out, parking, smoking, break_time, discount_info, avg_score, " +
            "restaurant_phone, restaurant_info, dong_info, restaurant_class, price_range " +
            "FROM restaurant " +
            "WHERE restaurant_name = ?";
        connection.query(select, [restaurantName], function (err, results) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                console.log(results + "12312");
                callback(null, connection, results);
            }
        });
    }

    function selectRestaurantDetails(connection, results, callback) {
        var idx = 0;
        async.eachSeries(results, function (item, cb) {
            var photo_select = "SELECT restaurant_photo_url as url " +
                               "FROM restaurant_photo " +
                               "WHERE restaurant_id = ?";
            var menu_select = "SELECT m.menu_class_id, menu_class_name, menu_name, menu_photo_url, price, main_ingredient " +
                              "FROM menu m join menu_class mc on (m.menu_class_id = mc.menu_class_id) " +
                              "WHERE restaurant_id = ?";
            async.series([function (cb2) {
                connection.query(photo_select, item.restaurant_id, function (err, restaurant_photo_results) {
                    console.log('아이템', item);
                    if (err) {
                        cb2(err);
                    } else {
                        results[idx].restaurantPhotoUrl = restaurant_photo_results;
                        console.log(restaurant_photo_results);
                        cb2(null);
                    }
                });
            }, function (cb2) {
                connection.query(menu_select, item.restaurant_id, function (err, restaurant_menu_results) {
                    if (err) {
                        cb2(err);
                    } else {
                        results[idx].menu = restaurant_menu_results;
                        cb2(null);
                    }
                });
            }], function (err) {
                if (err) {
                    cb(err);
                } else {
                    idx++;
                    cb(null);
                }
            });
        }, function (err) {
            if (err) {
                callback(err);
            } else {
                connection.release();
                callback(null, results);
            }
        });


    }
    function makeJSON(results, callback) {
        //JSON 객체 생성
        var restaurantList = [];

        async.eachSeries(results, function (item, cb) {
            var restaurant_element = {
                "listRestaurant": {
                    "restaurantName": item.restaurant_name,
                    //"restaurant_photo_url": item.restarant_photo_url,
                    "dongInfo": item.dong_info,
                    "restaurantCalss": item.restaurant_class
                },
                "detailRestaurant": {
                    "restaurantName": item.restaurant_name,
                    "address": item.address,
                    "websiteUrl": item.website_url,
                    "restaurantCalss": item.restaurant_class,
                    "rewardPhotoUrl": item.reward_photo_url,
                    "rewardInfo": item.reward_info,
                    "rewardName": item.reward_name,
                    "takeOut": item.take_out,
                    "parking": item.parking,
                    "smoking": item.smoking,
                    "breakTime": item.break_time,
                    "avgScore": item.avg_score,
                    "restaurantInfo": item.restaurant_info,
                    "restaurantPhotoUrl": item.restaurant_photo_url,
                    "menu": item.menu

                }
            };
            restaurant_element.listRestaurant.restaurantPhotoUrl = restaurant_element.detailRestaurant.restaurantPhotoUrl[0];
            restaurantList.push(restaurant_element);
            cb(null);
        }, function (err) {
            if (err) {
                callback(err);
            } else {
                console.log(restaurantList);
                var result = {
                    "data": restaurantList
                };
                callback(null, result);
            }
        });

    }

    async.waterfall([getConnection, selectRestaurant, selectRestaurantDetails, makeJSON], function (err, result) {
        if (err) {
            var err = new Error('레스토랑 조회에 실패하였습니다.');
            err.status = 401;
            err.code = "E0011";
            next(err);
        } else {
            var result = {
                "results": {
                    "message": "레스토랑 조회가 정상적으로 처리되었습니다.",
                    "data": result.data
                }
            };
            res.json(result);
        }
    });
});

module.exports = router;


