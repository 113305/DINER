// TODO: 레스토랑 검색하기 (/restaurants HTTP get)

var express = require('express');
var async = require('async');
var bcrypt = require('bcrypt');
var router = express.Router();

router.get('/', function (req, res, next) {
    function getRestName(callback) {
        var restaurants = {
            "restaurantName": req.query.restaurantName
        };
        callback(null, restaurants);
    }

    function getConnection(callback) {
        pool.getConnection(function (err, connection) {
            if (err) {
                callback(err);
            } else {
                callback(null, restaurants, connection);
            }
        });
    }

    function selectRestaurant(restaurant, connection, callback) {
        var sql = "";
        connection.query(sql, [restaurant.restaurant_name], function(err, results) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                if (results.length === 0) {
                    var error = new Error('레스토랑 검색에 실패하였습니다.');
                    error.status = 1;
                    error.code = "E0011";
                    next(error);
                } else {
                    restaurant.name = results[0].restaurant_name;
                }
            }
        })
    }

    async.waterfall([getRestName, getConnction, selectRestaurant], function(err, results) {  //테스크 수행 결과를 입력으로 전달하여 연결되는 구조라 waterfall
        if(err) {
            next(err);
        } else {
            console.log();
            res.json(restaurants);
        }
    });
});