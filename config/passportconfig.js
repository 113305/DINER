var LocalStrategy = require('passport-local').Strategy;
var FacebookTokenStrategy = require('passport-facebook-token');
var bcrypt = require('bcrypt');
var async = require('async');
var authConfig = require('./authconfig');
var hexkey = process.env.DINER_HEX_KEY;

var passportconfig = function(passport){

    passport.serializeUser(function(customer, done) {
        done(null, customer.id);
    });

    passport.deserializeUser(function(id, done) {
        pool.getConnection(function(err, connection) {
            if (err) {
                done(err);
            } else {
                //페이스북 정보도 추가하기
                var select = "SELECT customer_id, " +
                             "convert(aes_decrypt(customer_name, unhex(" + connection.escape(hexkey) + ")) using utf8) as name, " +
                             "convert(aes_decrypt(custmoer_email, unhex(" + connection.escape(hexkey) + ")) using utf8) as email, " +
                             "convert(aes_decrypt(customer_phone, unhex(" + connection.escape(hexkey) + ")) using utf8) as phone, " +
                             "convert(aes_decrypt(facebook_email, unhex(" + connection.escape(hexkey) + ")) using utf8) as facebookEmail, " +
                             "convert(aes_decrypt(facebook_name, unhex(" + connection.escape(hexkey) + ")) using utf8) as facebookName " +
                             "FROM customer " +
                             "WHERE customer_id = " + connection.escape(id);
                connection.query(select, function(err, results) {
                    if (err) {
                        connection.release();
                        done(err);
                    } else {
                        var customer = {
                            "id": results[0].customer_id,
                            "name": results[0].name,
                            "email": results[0].email,
                            "phone": results[0].phone,
                            "facebookEmail": results[0].facebookEmail,
                            "facebookName": results[0].facebookName
                        };
                        done(null, customer);
                    }
                });
            }
        });
    });

    passport.use('local-login', new LocalStrategy({
        usernameField: "email",
        passwordField: "password",
        passReqToCallback: true
    }, function(req, username, password, done) {

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            });
        }

        function selectCustomer(connection, callback) {
            var select = "SELECT customer_id, customer_acc_pwd " +
                         "FROM customer " +
                         "WHERE email = aes_encrypt(" + connection.escape(username) +
                         "                           , unhex(" + connection.escape(hexkey) + "))";

            connection.query(select, function(err, results) {
                connection.release();
                if (err) {
                    callback(err);
                } else {
                    if (results.length === 0 ){
                        var err = new Error('이메일 계정이 존재하지 않아 로그인에 실패하였습니다.');
                        err.status = 401;
                        err.code = 'E0005a';
                        done(err);
                    } else {
                        var customer = {
                            "id": results[0].customer_id,
                            "hashPassword": results[0].customer_acc_pwd
                        };
                        callback(null, customer);
                    }
                }
            });
        }

        function compareCustomerInput(customer, callback) {
            bcrypt.compare(password, customer.hashPassword, function(err, result) {
                if (err) {
                    callback(err);
                } else {
                    if (result) {
                        callback(null, customer);
                    } else {
                        callback(null, false);
                    }
                }
            });
        }

        async.waterfall([getConnection, selectCustomer, compareCustomerInput], function(err, customer) {
            if (err) {
                done(err);
            } else {
                delete customer.hashPassword;
                done(null, customer);
            }
        });
    }));

    passport.use('facebook-token', new FacebookTokenStrategy({
        "clientID": authConfig.facebook.appId,
        "clientSecret": authConfig.facebook.appSecret,
        "profileFields": ["id", "displayName", "emails"]
    }, function (accessToken, refreshToken, profile, done) {

        function getConnection(callback) {
            pool.getConnection(function(err, connection) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, connection);
                }
            });
        }

        function selectOrCreateCustomer(connection, callback) {
            var select = "SELECT customer_id, facebook_id, facebook_token " +
                         "FROM customer " +
                         "WHERE facebook_id = ?";
            connection.query(select, [profile.id], function(err, results) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    if (results.length === 0 ) {

                        var insert = "INSERT INTO customer (facebook_id, facebook_token, facebook_email, facebook_name) " +
                                     "VALUES(" + connection.escape(profile.id) + ", " +
                                                 connection.escape(accessToken) + ", " +
                                                 "aes_encrypt(" + connection.escape(profile.emails[0]) + ", unhex(" + connection.escape(hexkey) + "))" +  ", " +
                                                 "aes_encrypt(" + connection.escape(profile.name) + ", unhex(" + connection.escape(hexkey) + "))" +
                                            ")";
                        connection.query(insert, function(err, result) {
                            connection.release();
                            if (err) {
                                callback(err);
                            } else {
                                var customer = {
                                    "id": result.insertId
                                };
                                callback(null, customer);
                            }
                        });
                    } else {
                        if (accessToken === results[0].facebook_token) {
                            connection.release();
                            var customer = {
                                "id": results[0].id,
                                "facebook_id": results[0].facebook_id
                            };
                            callback(null, customer);
                        } else {
                            var update = "UPDATE customer " +
                                         "SET	facebook_token = ? " +
                                         "WHERE facebook_id = ?";
                            connection.query(update, [accessToken, profile.id], function(err, result) {
                                connection.release();
                                if (err) {
                                    callback(err);
                                } else {
                                    var customer = {
                                        "id": results[0].id,
                                        "facebook_id": results[0].facebook_id,
                                        "facebook_name": results[0].facebook_name,
                                        "facebook_email": results[0].facebook_email
                                    };
                                    callback(null, customer);
                                }
                            });
                        }
                    }
                }
            });
        }

        async.waterfall([getConnection, selectOrCreateCustomer], function(err, customer) {
            if (err) {
                done(err);
            } else {
                done(null, customer);
            }
        });
    }));
};

module.exports = passportconfig;
