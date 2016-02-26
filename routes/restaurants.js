// TODO: 레스토랑 검색하기 (/restaurants HTTP get)

var express = require('express');
var async = require('async');
var bcrypt = require('bcrypt');
var router = express.Router();

router.get('/', function (req, res, next) {

    var restaurants = req.query.restaurant_name;

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
        var datas = ['테스트','입니다'];
        var select = "SELECT id, restaurant_name, address, website_url, business_hours, "+
                     "reward_photo_url, reward_name, reward_info, "+
                     "take_out, parking, smoking, break_time, discount_info, avg_score, "+
                     "restaurant_phone, restaurant_info, dong_info, restaurant_class, price_range "+
                     "FROM restaurant "+
                     "WHERE restaurant_name = ?";
        connection.query(select, [restaurants], function(err, results) {
            if(err) {
                callback(err);
            } else {
                async.each(results, function(item, callback) {
                    var data = {
                        "list_restaurant": {
                            "restaurant_name": item.restaurant_name,
                            "restaurant_photo_url": item.restaurant_photo_url,
                            "dong_info": item.dong_info,
                            "restaurant_class": item.restaurant_class
                        },
                        "detail_restaurant": {
                            "restaurant_name": item.restaurant_name,
                            "address": item.address,
                            "website_url": item.website_url,
                            "price_range": item.price_range,
                            "reward_photo_url": item.reward_photo_url,
                            "reward_info": item.reward_info,
                            "reward_name": item.reward_name,
                            "take_out": item.take_out,
                            "parking": item.parking,
                            "smoking": item.smoking,
                            "break_time": item.break_time,
                            "avg_score": item.avg_score,
                            "restaurant_info": item.restaurant_info,
                            "restaurant_photo_url": [],
                            "menu": []
                        }
                    };

                        var photo_select = "select restaurant_photo_url as url "+
                            "from restaurant_photo "+
                            "where restaurant_id = ?";
                        connection.query(photo_select, [item.id], function(err, photo_results) {
                            if (err) {
                                connection.release();
                                callback(err);
                            } else {
                                async.each(photo_results, function (item, callback) {
                                    data.detail_restaurant.restaurant_photo_url.push(item.url);
                                    console.log('사진들어감',data.detail_restaurant.restaurant_photo_url);
                                    callback(null);
                                }, function (err, result) {
                                    if (err) {
                                        connection.release();
                                        callback(err);
                                    } else {

                                    }
                                });
                            }
                        });

                    var menu_select = "select menu_name, menu_photo_url, price, main_ingredient "+
                        "from menu "+
                        "where restaurant_id = ?";

                    connection.query(menu_select, [item.id], function(err, menu_results) {
                        if(err) {
                            connection.release();
                            callback(err);
                        } else {
                            async.each(menu_results, function(item, callback) {
                                console.log('아이템 : ',item.menu_name);
                                data.detail_restaurant.menu.push(item);
                                callback(null);
                            }, function(err, result) {
                                if(err) {
                                    connection.release();
                                    callback(err);
                                } else {
                                    datas.push(data);
                                    console.log('데이터스',datas);
                                }
                            })
                        }
                    });

                }, function(err, result) {
                    if(err) {
                        callback(err);
                    } else {

                    }
                })
                callback(null, datas);
            }
        });
    }

    async.waterfall([getConnection, selectRestaurant], function (err, datas) {
        if (err) {
            var err = new Error('레스토랑 조회에 실패하였습니다.');
            err.status = 401;
            err.code = "E0011";
            next(err);
        } else {
            console.log('결과',datas);
            var result = {
                "results": {
                    "message": "레스토랑 조회가 정상적으로 처리되었습니다.",
                    "data": datas
                }
            };
            res.json(result);
        }
    });
});

module.exports = router;