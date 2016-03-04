var express = require('express');
var async = require('async');
var moment = require('moment-timezone');
var nodeschedule = require('node-schedule');
var uuid = require('uuid');
var gcm = require('node-gcm');
var router = express.Router();

//TODO: err message들 상황별로 분류하기 transaction할 것있나 다시 생각해보기
//안드로이드 푸시하기
router.get('/:reservationId', function(req, res, next) {
    var reservationId = req.params.reservationId;
    var sender = new gcm.Sender('YOUR_API_KEY_HERE');

    //1. 커넥션
    function getConnection(callback) {
        pool.getConnection(function(err, connection) {
           if (err) {
               callback(err);
           } else {
               callback(null, connection);
           }
        });
    }
    //2. 예약 상태 확인하기
    function selectReservationState(connection, callback) {
        var select = "SELECT registration_token, restaurant_name, date_time, before_35m, before_60m, reservation_state " +
                     "FROM reservation JOIN customer " +
                     "                 ON (reservation.customer_id = customer.customer_id)";

        connection.query(select, [reservationId], function(err, results) {
            if (err) {
                callback(err);
            } else {
                var pushInfo = {
                    "registrationToken": results[0].registration_token,
                    "reservationState": results[0].reservation_state,
                    "restaurantName": results[0].restaurant_name,
                    "dateTime": results[0].date_time,
                    "before35": results[0].before_35m,
                    "before60": results[0].before_60m
                };
                callback(null, connection, pushInfo);
            }
        });
    }


    //3. job만들기
    function createJob(connection, pushInfo, callback) {
        var message = new gcm.Message();
        message.addNotification("title", "DINER");

        //예약 상태가 대기일경우
        if (reservationState === 0) {
            //job 생성하기
            function createStatePushJob(outercb) {
                var m = moment().tz('Asia/Seoul');
                var date = m.toDate();
                var jobName = "job-" + uuid.v4();
                var job = nodeschedule.scheduleJob(jobName, date, function(mm) {

                    var content = pushInfo.dateTime + pushInfo.restaurantName + ' 예약 신청이 완료되었습니다. 감사합니다.';
                    message.addNotification("body", content);

                    sender.send(message, pushInfo.registrationToken, function(err, result) {
                        if (err) {
                            outercb(err);
                        }  else {
                            var update = "UPDATE job " +
                                         "SET result_log = ? " +
                                         "WHERE job_name = ?";

                            connection.query(update, [result, jobName], function(err, result) {
                                if (err) {
                                    outercb(err);
                                } else {
                                    outercb(null);
                                }
                            });
                        }
                    });

                }.bind(null, m));

                //jobdb에 넣어주기
                var insert = "INSERT INTO job (job_name, reservation_id) " +
                             "VALUES (?, ?)";

                connection.query(insert, [jobName, reservationId], function(err, result) {
                    if (err) {
                        outercb(err);
                    } else {
                        outercb(null);
                    }
                });
            }

            function createBeforePushJob(outercb) {
                async.each([pushInfo.before60, pushInfo.before35], function(beforeTime, innercb) {
                    var date = beforeTime;
                    if (beforeTime === pushInfo.before60) {
                        var infoTime = '60분전 입니다. 감사합니다.';
                    } else {
                        var infoTime = '35분전 입니다. 예약 취소가 불가능 합니다.';
                    }
                    var jobName = "job-" + uuid.v4();
                    var job = nodeschedule.scheduleJob(jobName, date, function(mm) {

                        var content = pushInfo.dateTime + pushInfo.restaurantName + ' 예약 시간 ' + infoTime;
                        message.addNotification("body", content);

                        sender.send(message, pushInfo.registrationToken, function(err, result) {
                            if (err) {
                                cb(err);
                            }  else {
                                var update = "UPDATE job " +
                                             "SET result_log = ? " +
                                             "WHERE job_name = ?";

                                connection.query(update, [result, jobName], function(err, result) {
                                    if (err) {
                                        cb(err);
                                    } else {
                                        cb(null);
                                    }
                                });
                            }
                        });

                    }.bind(null, m));

                    //jobdb에 넣어주기
                    var insert = "INSERT INTO job (job_name, reservation_id) " +
                        "VALUES (?, ?)";

                    connection.query(insert, [jobName, reservationId], function(err, result) {
                        if (err) {
                            cb(err);
                        } else {
                            cb(null);
                        }
                    });
                }, function(err) {
                    outercb(err);
                });
            }

            async.parallel([
                createStatePushJob,
                createBeforePushJob
            ], function (err, results) {
                if(err){
                    callback(err);
                }else {
                    callback(null);
                }
            });

        } else {//예약 상태가 변경이나 취소일 경우
            //예약아이디로 jobName 알아내기
            var select = "SELECT job_name " +
                         "FROM job " +
                         "WHERE reservation_id = ?";

            connection.query(select, [reservationId], function(err, results) {
                if (err) {
                    callback(err);
                } else {
                    // job취소하기
                    async.each(results, function(jobName, cb) {
                        var selectedJob = nodeschedule.scheduledJobs[jobName];
                        selectedJob.cancel();
                        delete nodeschedule.scheduledJobs[jobName];
                        cb(null);
                    }, function(err) {
                        callback(err);
                    });
                }
            });

            if (reservationState === 4) {//예약 상태가 변경일 경우
                //job 생성하기
                function createBeforePushJob(outercb) {
                    async.each([pushInfo.before60, pushInfo.before35], function(beforeTime, innercb) {
                        var date = beforeTime;
                        if (beforeTime === pushInfo.before60) {
                            var infoTime = '60분전 입니다. 감사합니다.';
                        } else {
                            var infoTime = '35분전 입니다. 예약 취소가 불가능 합니다.';
                        }
                        var jobName = "job-" + uuid.v4();
                        var job = nodeschedule.scheduleJob(jobName, date, function(mm) {

                            var content = pushInfo.dateTime + pushInfo.restaurantName + ' 예약 시간 ' + infoTime;
                            message.addNotification("body", content);

                            sender.send(message, pushInfo.registrationToken, function(err, result) {
                                if (err) {
                                    cb(err);
                                }  else {
                                    var update = "UPDATE job " +
                                        "SET result_log = ? " +
                                        "WHERE job_name = ?";

                                    connection.query(update, [result, jobName], function(err, result) {
                                        if (err) {
                                            cb(err);
                                        } else {
                                            cb(null);
                                        }
                                    });
                                }
                            });

                        }.bind(null, m));

                        //jobdb에 넣어주기
                        var insert = "INSERT INTO job (job_name, reservation_id) " +
                                     "VALUES (?, ?)";

                        connection.query(insert, [jobName, reservationId], function(err, result) {
                            if (err) {
                                cb(err);
                            } else {
                                cb(null);
                            }
                        });
                    }, function(err) {
                        outercb(err);
                    });
                }
                //예약상태 변경에서 대기로 변경하기
                function updateReservationState(outercb) {
                    var update = "UPDATE reservation " +
                                 "SET reservation_state = 0 " +
                                 "WHERE reservation_id = ?";
                    connection.query(update, [reservationId], function(err, result) {
                       if (err) {
                           cb(err);
                       } else {
                           cb(null);
                       }
                    });
                }

                async.parallel([
                    createBeforePushJob,
                    updateReservationState
                ], function (err, results) {
                    if(err){
                        callback(err);
                    }else {
                        callback(null);
                    }
                });


            }
        }
    }

    async.waterfall([getConnection, selectReservationState, createJob], function(err) {
        if (err) {
            var err = new Error('');
            err.code = '';
            next(err);
        } else {
            var results = {
                "result": {
                    "message": ""
                }
            };
            next(results);
        }
    });
});



module.exports = router;