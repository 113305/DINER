// 지역 확인하기 (/regions HTTP GET)
var express = require('express');
var async = require('async');
var bcrypt = require('bcrypt');
var router = express.Router();

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
                  "FROM diner.region";
        connection.query(sql, function(err, results) {
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

    async.waterfall([getConnection, getRegions], function(err, results) {
        if (err) {
            var err = new Error('지역 조회에 실패하였습니다.');
            err.code = "E0009";
            next(err);
        } else {
            res.json(results);
        }
    });
});


// TODO: 레스토랑 목록보기 (/regions/:regionId HTTP GET)

router.get('/:regionId', function(req, res, next) {
    function getConnection (callback) {
        pool.getConnection(function(err, connection) {
            if (err) {
                callback(err);
            } else {
                callback(null, connection);
            }
        });
    }

    function selectRegions (connection, callback) {
        var sql  = "SELECT restaurant_name, address, website_url, business_hours, " +
            "       reward_photo_url, reward_name, reward_info, " +
            "       take_out, parking, smoking, break_time, discount_info, r.avg_score, " +
            "       restaurant_phone, restaurant_info, r.dong_info, r.restaurant_class, r.price_range, " +
            "       menu_name, menu_photo_url, m.price, m.main_ingredient, m.popular, mc.menu_class_name " +
            "FROM restaurant r join menu m on (r.id = m.restaurant_id) " +
            "                  join menu_class mc on (m.menu_class_id = mc.id) " +
            "WHERE region_id = ?";

        connection.query(sql, [req.params.regionId], function (err, results) {
            if (err) {
                connection.release();
                callback(err);
            } else {
                var data = [];
                for (var i=0; i<restaurants.length; i++){
                    data[i] = {
                        "list_restaurant": {
                            "restaurant_name": results[0].r.restaurant_name,
                            "restaurant_photo_url": "",
                            "dong_info": "",
                            "restaurant_class": ""
                        },
                        "detail_restaurant": {
                            "restaurant_name": "",
                            "address": "",
                            "website_url": "",
                            "price_range": "",
                            "reward_photo_url": "",
                            "reward_info": "",
                            "reward_name": "",
                            "take_out": "",
                            "parking": "",
                            "smoking": "",
                            "break_time": "",
                            "avg_score": "",
                            "restaurant_photo_url" : [""],
                            "restaurant_info": "",
                            "menu": [{
                                "menu_class_name": "",
                                "menu_name": "",
                                "price": "",
                                "main_ingredient": "",
                                "menu_photo_url": "",
                                "popular": ""
                            }]
                        }
                    };
                }
                var result = {
                    "results": {
                        "message": "레스토랑 조회가 정상적으로 처리되었습니다.",
                        "data": data
                    }

                };
                callback(null, results);
            }
        })
    }


    async.waterfall([getConnection, selectRegions], function(err, results) {
        if (err) {
            var err = new Error('레스토랑 조회에 실패하였습니다.');
            err.code = "E0010";
            next(err);
        } else {
            res.json(results);
        }
    });
});



module.exports = router;