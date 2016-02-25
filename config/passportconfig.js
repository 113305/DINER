var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcrypt');
var async = require('async');

var passportconfig = function(passport){
    passport.serializeUser(function(customer, done) {
        done(null, customer.id);
    });

    passport.deserializeUser(function(id, done) {
        pool.getConnection(function(err, connection) {
            if (err) {
                done(err);
            } else {
                var sql = "SELECT id, customer_name " +
                          "FROM diner.customer " +
                          "WHERE email = ?";
                connection.query(sql, [id], function(err, results) {
                    if (err) {
                        done(err);
                        connection.release();
                    } else {
                        var user = {
                            "id": results[0].id,
                            "name": results[0].customer_name
                        };
                        done(null, user);
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
            var select = "SELECT id, customer_name, customer_acc_pwd " +
                         "FROM diner.customer " +
                         "WHERE email = ?";

            connection.query(select, [username], function(err, results) {
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
                            "email": username,
                            "name": results[0].custmomer_name,
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
                        callback(customer);
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
                done(customer);
            }
        });
    }));
};

module.exports = passportconfig;