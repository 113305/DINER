// TODO: 회원가입하기(/customer HTTPS POST) 암호화필요
// 회원가입 할 때
// member = 회원가입을 담당하는 미들웨어
var express = require('express');
var bcrypt = require('bcrypt');
var async = require('async');
var router = express.Router();

function isLoggedIn (req, res, next) { // 로그인 성공 여부 확인
    if (!req.session.userId) {  // userId가 없으면
        var err = new Error('로그인이 필요합니다...');
        err.status = 401;
        next(err);
    } else {
        next();  // 성공하면 get 요청 처리
    }
}

router.post('/', function (req, res, next) {  // 회원 가입
    var username = req.body.username;
    var password = req.body.password;
    //암호화해서 저장해야 하기 때문에 모듈이 필요 -> bcrypt 모듈(윈도우즈에서는 python 2.7 설치 되있어야 설치됨)
    //서버에서는 문제 없음

    //TODO: 1. salt generation (원본 암호를 암호화)
    //작성 다하면 투두 지우면 주석만남음
    function generateSalt (callback) {
        var rounds = 10;
        bcrypt.genSalt(rounds, function (err, salt) {  //솔트 문자열 생성하는데 default값이 10
            if (err) {
                callback(err);
            } else {
                callback(null, salt);
            }
        });
    }

    //TODO: 2. hash password generation (암호화된 원본암호를 해쉬함수를 이용해서 암호화)
    function generateHashPassword (salt, callback) {
        bcrypt.hash(password, salt, function (err, hashPassword) {
            if (err) {
                callback(err);
            } else {
                callback(null, hashPassword);
            }
        });

    }

    //TODO: 3. get connection
    function getConnection (hashPassword, callback) {
        pool.getConnection(function (err, connection) {
            if (err) {
                callback(err);
            } else {
                callback(null, connection, hashPassword);
            }
        });
    }

    //TODO: 4. DB instert
    function insertMember(connection, hashPassword, callback) {  // 쿼리사용하면 커넥션 불러와야함
        var sql = "INSERT INTO memberdb.user (username, password) " +
            "VALUE (?, ?)";
        connection.query(sql, [username, hashPassword], function (err, result) {
            connection.release();
            if (err) {
                callback(err);
            } else {
                callback(null, {
                    "id": result.insertId
                });
            }
        });

    }

    async.waterfall([generateSalt, generateHashPassword, getConnection, insertMember], function(err, result) {
        if (err) {
            next(err);
        } else {
            result.message = "정상적으로 사용자가 저장되었습니다.";
            res.json(result);
        }
    });
});

router.get('/me', isLoggedIn, function (req, res, next) {  // 내 정보 요청
    //DB select with req.session.userId
    // 후, 정보를 가져와서  res.json 정보를 클라이언트에게 전달
    res.json({
        "userId": req.session.userId
        //"username": "",
        //"photoUrl": ""
    });
});



module.exports = router;
// TODO: 회원정보 확인하기(/customers/me HTTPS GET)

// TODO: 회원정보 변경하기 (/customers/me HTTPS PUT)

// TODO: 회원 탈퇴하기 (/customers HTTP DELETE)
