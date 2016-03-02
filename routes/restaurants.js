 // TODO: 레스토랑 검색하기 (전체에서 이름  검색) (/restaurants HTTP get)

var express = require('express');
var async = require('async');
var bcrypt = require('bcrypt');
var router = express.Router();

router.get('/', function (req, res, next) {

    var restaurantName = req.query.name;

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
            var photo_select = "select restaurant_photo_url as url " +
                               "from restaurant_photo " +
                               "where restaurant_id = ?";
            var menu_select = "select menu_name, menu_photo_url, price, main_ingredient " +
                              "from menu " +
                              "where restaurant_id = ?";
            async.series([function (cb2) {
                connection.query(photo_select, item.restaurant_id, function (err, restaurant_photo_results) {
                    console.log('아이템', item);
                    if (err) {
                        cb2(err);
                    } else {
                        results[idx].restaurant_photo_url = restaurant_photo_results;
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
                "list_restaurant": {
                    "restaurant_name": item.restaurant_name,
                    //"restaurant_photo_url": item.restarant_photo_url,
                    "dong_info": item.dong_info,
                    "restaurant_calss": item.restaurant_class
                },
                "detail_restaurant": {
                    "restaurant_name": item.restaurant_name,
                    "address": item.address,
                    "website_url": item.website_url,
                    "price_range": item.price_range,
                    "restaurant_calss": item.restaurant_class,
                    "reward_photo_url": item.reward_photo_url,
                    "reward_info": item.reward_info,
                    "reward_name": item.reward_name,
                    "take_out": item.take_out,
                    "parking": item.parking,
                    "smoking": item.smoking,
                    "break_time": item.break_time,
                    "avg_score": item.avg_score,
                    "restaurant_info": item.restaurant_info,
                    "restaurant_photo_url": item.restaurant_photo_url,
                    "menu": item.menu
                }
            };
            restaurant_element.list_restaurant.restaurant_photo_url = restaurant_element.detail_restaurant.restaurant_photo_url[0];
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



//
//var express = require('express');
//var async = require('async');
//var bcrypt = require('bcrypt');
//var router = express.Router();
//
//router.get('/', function (req, res, next) {
//
//    var restaurants = req.query.restaurantName;
//
//    function getConnection(callback) {
//        pool.getConnection(function (err, connection) {
//            if (err) {
//                callback(err);
//            } else {
//                callback(null, connection);
//            }
//        });
//    }
//
//    function selectRestaurant(connection, callback) {
//        //var datas = [];
//        var select = "SELECT restaurant_id, restaurant_name, address, website_url, business_hours, "+
//            "reward_photo_url, reward_name, reward_info, "+
//            "take_out, parking, smoking, break_time, discount_info, avg_score, "+
//            "restaurant_phone, restaurant_info, dong_info, restaurant_class, price_range "+
//            "FROM restaurant "+
//            "WHERE restaurant_name = ?";
//        connection.query(select, [restaurants], function(err, results) {
//            if(err) {
//                callback(err);
//            } else {
//                console.log(results + "1211312");
//                callback(null, connection, results);
//            }
//        });
//    }
//
//    function selectRestaurantDetails (connection, results, callback){
//        var idx = 0;
//        async.eachSeries(results ,function(item,cb){
//            var photo_select = "select restaurant_photo_url as url "+
//                "from restaurant_photo "+
//                "where restaurant_id = ?";
//            var menu_select = "select menu_name, menu_photo_url, price, main_ingredient "+
//                "from menu "+
//                "where restaurant_id = ?";
//            async.series([function (cb2) {
//                connection.query(photo_select, item.id, function (err, restaurant_photo_results) {
//                    if (err) {
//                        cb2(err);
//                    } else {
//                        results[idx].restaurant_photo_url = restaurant_photo_results;
//                        console.log(restaurant_photo_results);
//                        cb2(null);
//                    }
//                });
//            }, function (cb2) {
//                connection.query(menu_select, item.id, function (err,  restaurant_menu_results) {
//                    if (err) {
//                        cb2(err);
//                    } else {
//                        results[idx].menu = restaurant_menu_results;
//                        cb2(null);
//                    }
//                });
//            }], function (err) {
//                if(err){
//                    cb(err);
//                }else{
//                    idx++;
//                    cb(null);
//                }
//            });
//        },function (err) {
//            if (err) {
//                callback(err);
//            } else {
//                connection.release();
//                callback(null, results);
//            }
//        });
//
//
//    }
//    function makeJSON(results, callback){
//        //JSON 객체 생성
//
//        var restaurantList = [];
//
//        async.eachSeries(results, function (item, cb) {
//            var restaurant_element = {
//                "detail_restaurant": {
//                    "restaurant_name": item.restaurant_name,
//                    "address": item.address,
//                    "website_url": item.website_url,
//                    "price_range": item.price_range,
//                    "reward_photo_url": item.reward_photo_url,
//                    "reward_info": item.reward_info,
//                    "reward_name": item.reward_name,
//                    "take_out": item.take_out,
//                    "parking": item.parking,
//                    "smoking": item.smoking,
//                    "break_time": item.break_time,
//                    "avg_score": item.avg_score,
//                    "restaurant_info": item.restaurant_info,
//                    "restaurant_photo_url": item.restaurant_photo_url,
//                    "menu": item.menu
//                }
//
//            };
//            restaurantList.push(restaurant_element);
//            cb(null);
//        }, function (err) {
//            if (err) {
//                callback(err);
//            } else {
//                console.log(restaurantList);
//                var restaurant_results = {
//                    "successResult": {
//                        /* "message": "모든 아티스트들이 정상적으로 조회 되었습니다.",
//                         "page": page,
//                         "listPerPage": listPerPage,*/
//                        "restaurantList": restaurantList
//                    }
//                };
//                callback(null, restaurant_results);
//            }
//        });
//
//    }
//
//    async.waterfall([getConnection, selectRestaurant,selectRestaurantDetails, makeJSON], function (err, datas) {
//        if (err) {
//            var err = new Error('레스토랑 조회에 실패하였습니다.');
//            err.status = 401;
//            err.code = "E0011";
//            next(err);
//        } else {
//            //console.log('결과',datas);
//            /* var result = {
//             "results": {
//             "message": "레스토랑 조회가 정상적으로 처리되었습니다.",
//             "data": datas
//             }
//             };*/
//            res.json(datas);
//        }
//    });
//});
//
//module.exports = router;