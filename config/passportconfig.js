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
                var select = "SELECT id, " +
                             "convert(aes_decrypt(customer_name, unhex(" + connection.escape(hexkey) + ")) using utf8), " +
                             "convert(aes_decrypt(custmoer_email, unhex(" + connection.escape(hexkey) + ")) using utf8), " +
                             "convert(aes_decrypt(customer_phone, unhex(" + connection.escape(hexkey) + ")) using utf8), " +
                             "FROM dinerdb.customer " +
                             "WHERE id = ?";
                connection.query(select, function(err, result) {
                    if (err) {
                        connection.release();
                        done(err);
                    } else {
                        var customer = {
                            "id": results[0].id,
                            "name": name,
                            "email": email,
                            "phone": phone
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
            var select = "SELECT id, customer_acc_pwd " +
                         "FROM dinerdb.customer " +
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
                            "id": results[0].id,
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
            var select = "SELECT id, facebook_id, facebook_email, " +
                         "       facebook_name, facebook_token " +
                         "FROM dinerdb.customer " +
                         "WHERE facebook_id = aes_encrypt(" + connection.escape(profile.id) +
                         "                                , unhex(" + connection.escape(hexkey) + "))";
            connection.query(select, [profile.id], function(err, results) {
                if (err) {
                    connection.release();
                    callback(err);
                } else {
                    if (results.length === 0 ) {

                        var insert = "INSERT INTO dinerdb.customer (facebook_id, facebook_token, facebook_email, facebook_name) " +
                                     "VALUES(" + connection.escape(profile.id) + ", " +
                                              connection.escape(accessToken) +
                                              "aes_encrypt(" + connection.escape(profile.emails[0]) + ", unhex(" + connection.escape(hexkey) + "))" +  ", " +
                                              "aes_encrypt(" + connection.escape(profile.name) + ", unhex(" + connection.escape(hexkey) + "))" +  ", " +
                        connection.query(insert, function(err, result) {
                            connection.release();
                            if (err) {
                                callback(err);
                            } else {
                                var customer = {
                                    "id": result.insertId,
                                    "facebook_id": result.profile.id,
                                    "facebook_email": result.profile.emails[0],
                                    "facebook_name": result.profile.name
                                };
                                callback(null, customer);
                            }
                        });
                    } else {
                        if (accessToken === results[0].facebook_token) {
                            connection.release();
                            var customer = {
                                "id": results[0].id,
                                "facebook_id": results[0].facebook_id,
                                "facebook_email": results[0].facebook_email,
                                "facebook_name": results[0].facebook_name
                            };
                            callback(null, customer);
                        } else {
                            var update = "UPDATE dinerdb.customer " +
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
                                        "facebook_email": results[0].facebook_email,
                                        "facebook_name": results[0].facebook_name
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
