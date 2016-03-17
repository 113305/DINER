// TODO: 레스토랑 검색하기 (전체에서 이름  검색) (/restaurants HTTP get)

var express = require('express');
var async = require('async');
var router = express.Router();

router.get('/', function (req, res, next) {

    var restaurantName = req.query.restaurantName;

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
        var select = "SELECT r.restaurant_id as restaurant_id, restaurant_name, restaurant_photo_url, " +
                     "       dong_info, restaurant_class " +
                     "FROM restaurant r join restaurant_photo rp on (r.restaurant_id = rp.restaurant_id) " +
                     "WHERE restaurant_name = ? " +
                     "GROUP BY restaurant_id";
        connection.query(select, [restaurantName], function (err, results) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                var result = [];

                async.each(results, function(restaurant, cb1) {
                    result.push({
                        "restaurantId": restaurant.restaurant_id,
                        "restaurantName": restaurant.restaurant_name,
                        "dongInfo": restaurant.dong_info,
                        "restaurantClass": restaurant.restaurant_class,
                        "restaurantPhotoUrl": restaurant.restaurant_photo_url
                    });
                    cb1(null);
                }, function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, result);
                    }
                });

                var result1 = {
                    "results": {
                        "message": "레스토랑 조회가 정상적으로 처리되었습니다.",
                        "data": result
                    }
                };

                callback(null, result1);
            }
        });
    }

    async.waterfall([getConnection, selectRestaurant], function (err, result) {
        if (err) {
            var err = new Error('레스토랑 조회에 실패하였습니다.');
            err.status = 401;
            err.code = "E0012";
            next(err);
        } else {
            res.json(result);
        }
    });
});


// TODO: 레스토랑 상세정보 보기 (/restaurants/:restaurantId  HTTP GET)

router.get('/:restaurantId', function (req, res, next) {

    var restaurantId = req.params.restaurantId;

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
        var sql = "SELECT restaurant_id, restaurant_name, address, website_url, business_hours, " +
                  "       reward_photo_url, reward_name, reward_info, " +
                  "       take_out, parking, smoking, break_time, discount_info, avg_score, " +
                  "       restaurant_phone, restaurant_info " +
                  "FROM restaurant " +
                  "WHERE restaurant_id = ?";

        connection.query(sql, [restaurantId], function(err, results) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                var result = {
                    "restaurantId": results[0].restaurant_id,
                    "restaurantName": results[0].restaurant_name,
                    "address": results[0].address,
                    "websiteUrl": results[0].website_url,
                    "businessHours": results[0].business_hours,
                    "rewardPhotoUrl": results[0].reward_photo_url,
                    "rewardName": results[0].reward_name,
                    "rewardInfo": results[0].reward_info,
                    "takeOut": results[0].take_out,
                    "parking": results[0].parking,
                    "smoking": results[0].smoking,
                    "breakTime": results[0].break_time,
                    "discountInfo": results[0].discount_info,
                    "avgScore": results[0].avg_score,
                    "restaurantPhone": results[0].restaurant_phone,
                    "restaurantInfo": results[0].restaurant_info,
                    "restaurantPhotoUrl": [],
                    "menu": []
                };

                callback(null, connection, result);
            }
        });
    }

    function selectRestaurantPhotoUrl(connection, result, callback) {
        var sql = "SELECT restaurant_photo_url " +
                  "FROM restaurant_photo " +
                  "WHERE restaurant_id = ?";

        connection.query(sql, [restaurantId], function(err, results) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                async.eachSeries(results, function(photo, cb1) {
                    result.restaurantPhotoUrl.push({
                        "restaurantPhotoUrl": photo.restaurant_photo_url
                    });
                    cb1(null);
                }, function(err) {
                    if (err) {
                        connection.release();
                        callback(err);
                    } else {
                        callback(null, connection, result);
                    }
                });

            }

        });
    }

    function selectRestaurantMenu(connection, result, callback) {
        var sql = "SELECT m.menu_class_id as menu_class_id, menu_class_name, " +
                  "       menu_id, menu_name, menu_photo_url, price, main_ingredient, popular " +
                  "FROM menu m join menu_class mc on (m.menu_class_id = mc.menu_class_id) " +
                  "WHERE restaurant_id = ?";

        connection.query(sql, [restaurantId], function(err, results) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                async.eachSeries(results, function(menu, cb1) {
                    result.menu.push({
                        "menuClassId": menu.menu_class_id,
                        "menuClassName" : menu.menu_class_name,
                        "menuId": menu.menu_id,
                        "menuName": menu.menu_name,
                        "price": menu.price,
                        "mainIngredient": menu.main_ingredient,
                        "menuPhotoUrl": menu.menu_photo_url,
                        "popular": menu.popular
                    });
                    cb1(null);
                }, function(err) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, result);
                    }
                });
            }

        });
    }


    async.waterfall([getConnection, selectRestaurant, selectRestaurantPhotoUrl, selectRestaurantMenu], function (err, result) {
        if (err) {
            var err = new Error('레스토랑 싱세정보 조회에 실패하였습니다.');
            err.status = 401;
            err.code = "E0011";
            next(err);
        } else {
            var result = {
                "results": {
                    "message": "레스토랑 상세정보 조회가 정상적으로 처리되었습니다.",
                    "data": result
                }
            };
            res.json(result);
        }
    });
});

module.exports = router;


