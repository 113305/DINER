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
            if (err) {
                connection.release();
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
                    })
                }, function(err) {
                    if (err) {
                        cb1(err);
                    } else {
                        cb1(null);
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
        var select = "SELECT restaurant_id, restaurant_name, address, website_url, business_hours, " +
                     "       reward_photo_url, reward_name, reward_info, " +
                     "       take_out, parking, smoking, break_time, discount_info, avg_score, " +
                     "       restaurant_phone, restaurant_info " +
                     "FROM restaurant " +
                     "WHERE restaurant_id = ?";
        connection.query(select, [restaurantId], function (err, results) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                callback(null, connection, results);
            }
        });
    }

    function selectRestaurantDetails(connection, results, callback) {
        var idx = 0;
        async.eachSeries(results, function (item, cb) {
            var photo_select = "SELECT restaurant_photo_url as restaurantPhotoUrl " +
                "FROM restaurant_photo " +
                "WHERE restaurant_id = ?";
            var menu_select = "SELECT m.menu_class_id as menuClassId, menu_class_name as menuClassName, " +
                              "       menu_name as menuName, menu_photo_url as menuPhotoUrl, price, " +
                              "       main_ingredient as mainIngredient " +
                              "FROM menu m join menu_class mc on (m.menu_class_id = mc.menu_class_id) " +
                              "WHERE restaurant_id = ?";
            async.series([function (cb2) {
                connection.query(photo_select, item.restaurant_id, function (err, photoResults) {
                    if (err) {
                        cb2(err);
                    } else {
                        results[idx].restaurant_photo_url = photoResults;
                        cb2(null);
                    }
                });
            }, function (cb2) {
                connection.query(menu_select, item.restaurant_id, function (err, menuResults) {
                    if (err) {
                        cb2(err);
                    } else {
                        results[idx].menu = menuResults;
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
        var restaurant_element = {};

        async.eachSeries(results, function (item, cb) {
            restaurant_element = {
                    "restaurantId": item.restaurant_id,
                    "restaurantName": item.restaurant_name,
                    "address": item.address,
                    "restaurantPhone": item.restaurant_phone,
                    "businessHours": item.business_hours,
                    "websiteUrl": item.website_url,
                    "restaurantClass": item.restaurant_class,
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
            };
            cb(null, restaurant_element);
        }, function (err) {
            if (err) {
                callback(err);
            } else {
                var result = {
                    "data": restaurant_element
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


