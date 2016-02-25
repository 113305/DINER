// TODO: 지역 확인하기 (/regions HTTP GET)
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
                var results = {
                    "message": "지역조회가 정상적으로 처리되었습니다.",
                    "data": results
                };
                callback(null, results);
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
            console.log('조회완료');
        }
    });
});

//
//// TODO: 레스토랑 목록보기 (/regions/:regionId HTTP GET)
//
//router.get('/:regionId', function(req, res, next) {
//    function getConnection (callback) {
//        pool.getConnection(function(err, connection) {
//            if (err) {
//                callback(err);
//            } else {
//                callback(null, connection);
//            }
//        });
//    }
//
//    function selectRegions (connection, callback) {
//        var sql  = "SELECT id " +
//                   "FROM restaurant " +
//                   "where region_id = ?";
//        connection.query(sql, [region_id], function (err, results) {
//            if (err) {
//                connection.release();
//                callback(err);
//            } else {
//                callback(null)
//            }
//        })
//    }
//});

module.exports = router;