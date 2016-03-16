// TODO: 지역 확인하기 (/regions HTTP GET)
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
                        var sql = "SELECT region_id, region_name, region_photo_url " +
                            "FROM region";
                        connection.query(sql, function (err, results) {
                            if (err) {
                                connection.release();
                                callback(err);
                            } else {
                                var result = [];

                                async.each(results, function(region, cb1) {
                                    result.push({
                                        "regionId":region.region_id,
                                        "regionPhotoUrl": region.region_photo_url,
                                        "regionName": region.region_name
                                    })

                }, function(err) {
                    if (err) {
                        cb1(err);
                    } else {
                        cb1(null);
                    }
                });
                var result = {
                    "results": {
                        "message": "지역조회가 정상적으로 처리되었습니다.",
                        "data": result
                    }
                };

                connection.release();
                callback(null, result);
            }
        });
    }

    async.waterfall([getConnection, getRegions], function (err, result) {
        if (err) {
            var err = new Error('지역 조회에 실패하였습니다.');
            err.code = "E0009";
            next(err);
        } else {
            res.json(result);
        }
    });
});


// TODO : 지역 내 레스토랑 목록보기 (/regions/:regionId HTTP GET)

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
            var select = "SELECT r.restaurant_id as restaurant_id, restaurant_name, restaurant_photo_url, " +
                         "       dong_info, restaurant_class " +
                         "FROM restaurant r join restaurant_photo rp on (r.restaurant_id = rp.restaurant_id) " +
                         "WHERE region_id = ? " +
                         "GROUP BY restaurant_id";
        } else {  // 쿼리 있을때 (구에서) 이름 조회 
            var select = "SELECT r.restaurant_id as restaurant_id, restaurant_name, restaurant_photo_url, " +
                         "       dong_info, restaurant_class " +
                         "FROM restaurant r join restaurant_photo rp on (r.restaurant_id = rp.restaurant_id) " +
                         "WHERE region_id = ? and restaurant_name = ?" +
                         "GROUP BY restaurant_id";
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

                    connection.release();
                    callback(null, result1);
                }

            }
        });
    }



    async.waterfall([getConnection, selectRestaurant], function (err, result) {
        if (err) {
            var err = new Error('레스토랑 조회에 실패하였습니다.');
            err.status = 401;
            err.code = "E0010b";
            next(err);
        } else {
            //var result = {
            //    "results": {
            //        "message": "레스토랑 조회가 정상적으로 처리되었습니다.",
            //        "data": result
            //    }
            //};
            res.json(result);
        }
    });
});



module.exports = router;