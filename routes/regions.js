// 지역 확인하기 (/regions HTTP GET)
var express = require('express');
var async = require('async');
var bcrypt = require('bcrypt');
var router = express.Router();
var url = require('url');
var queryString = require('querystring');

router.get('/', function (req, res, next) {
    function getConnection(callback) {
        //pool에서 connection 얻어오기
        pool.getConnection(function (err, connection) {
            if (err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function getRegions(connection, callback) {
        var sql = "SELECT region_name, region_photo_url " +
                  "FROM region";
        connection.query(sql, function (err, results) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                var result = {
                    "results": {
                        "message": "지역조회가 정상적으로 처리되었습니다.",
                        "data": results
                    }
                };
                callback(null, result);
            }
        });
    }

    async.waterfall([getConnection, getRegions], function (err, results) {
        if (err) {
            var err = new Error('지역 조회에 실패하였습니다.');
            err.code = "E0009";
            next(err);
        } else {
            res.json(results);
        }
    });
});


// 레스토랑 목록보기 (/regions/:regionId HTTP GET)

router.get('/:regionId', function (req, res, next) {
    var regionId = req.params.regionId;
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

        if (req.query.restaurantName === undefined) {  // 쿼리 없을때 (구)전체 조회
            var select = "SELECT restaurant_id , restaurant_name, " +
                         "       address, website_url, business_hours, " +
                         "       reward_photo_url, reward_name, reward_info, " +
                         "       take_out, parking, smoking, break_time, discount_info, avg_score, " +
                         "       restaurant_phone, restaurant_info, dong_info, restaurant_class " +
                         "FROM restaurant " +
                         "WHERE region_id = ?";
        } else {  // 쿼리 있을때 (구에서) 이름 조회 
            var select = "SELECT restaurant_id, restaurant_name, address, website_url, business_hours, " +
                         "       reward_photo_url, reward_name, reward_info, " +
                         "       take_out, parking, smoking, break_time, discount_info, avg_score, " +
                         "       restaurant_phone, restaurant_info, dong_info, restaurant_class " +
                         "FROM restaurant " +
                         "WHERE region_id = ? and restaurant_name = ?";
        }
        connection.query(select, [regionId, restaurantName], function (err, results) {
            if (err) {
                callback(err);
            } else {
                if (results.length === 0) {
                    var err = new Error('검색 결과가 없습니다.');
                    err.code = "E0010a";
                    next(err);
                } else {
                    callback(null, connection, results);
                }

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
                        //results[idx].menu = restaurant_menu_results;
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

        var restaurantList = [];

        async.eachSeries(results, function (item, cb) {
            var restaurant_element = {
                "listRestaurant": {
                    "restaurantName": item.restaurant_name,
                    "dongInfo": item.dong_info,
                    "restaurantCalss": item.restaurant_class
                },
                "detailRestaurant": {
                    "restaurantId": item.restaurant_id,
                    "restaurantName": item.restaurant_name,
                    "address": item.address,
                    "businessHours": item.business_hours,
                    "websiteUrl": item.website_url,
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
            err.code = "E0010b";
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