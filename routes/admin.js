var express = require('express');
var async = require('async');
var moment = require('moment-timezone');
var nodeschedule = require('node-schedule');
var uuid = require('uuid');
var gcm = require('node-gcm');

var router = express.Router();
var logger = require('../config/loggerconfig');
var sender = process.env.DINER_GCM_KEY;


//안드로이드 푸시하기
router.get('/:reservationId', function(req, res, next) {
    var reservationId = req.params.reservationId;
    var sender = new gcm.Sender(sender);
    var title = 'DINER';

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
        var select = "SELECT registration_token, restaurant_name, " +
                     "       date_time, " +
                     "       before_35m, " +
                     "       before_60m, " +
                     "       date_format(CONVERT_TZ(before_35m, 'UTC', 'Asia/Seoul'), '%Y년 %m월 %d일  %h:%i%p') as B35, " +
                     "       date_format(CONVERT_TZ(before_60m, 'UTC', 'Asia/Seoul'), '%Y년 %m월 %d일  %h:%i%p') as B60, reservation_state " +
                     "FROM reservation JOIN customer " +
                     "                 ON (reservation.customer_id = customer.customer_id)" +
                     "                 JOIN restaurant " +
                     "                 ON (reservation.restaurant_id = restaurant.restaurant_id)" +
                     "WHERE reservation_id = ?";

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
                    "before60": results[0].before_60m,
                    "B35": results[0].B35,
                    "B60": results[0].B60
                };
                callback(null, connection, pushInfo);
            }
        });
    }

    //3. job만들기
    function generateJob(connection, pushInfo, callback) {
        //예약 상태가 대기일경우
        if (pushInfo.reservationState === 0) {

            var message = new gcm.Message();
            message.addData('title', title);

            //예약 시간 전 알림해주기
            async.eachSeries([pushInfo.before60, pushInfo.before35], function(beforeTime, cb) {
                var info = '';
                var time = '';
                if (beforeTime === pushInfo.before60) {
                    info = '60분 전 입니다. 감사합니다.';
                    time = 'B60';
                } else {
                    info = '35분 전 입니다. 예약 취소가 불가능 합니다.';
                    time = 'B35';
                }

                var jobName = time + '-' + uuid.v4();
                var job = nodeschedule.scheduleJob(jobName, beforeTime, function() {
                    pool.getConnection(function(err, connection) {

                        var content = pushInfo[time] + ' ' + pushInfo.restaurantName + ' 예약 시간 ' + info;
                        message.addData('message', content);

                        var select = "SELECT job_id " +
                            "FROM job " +
                            "WHERE job_name = ?";

                        connection.query(select, [jobName], function(err, results) {
                            var jobId = results[0].job_id;
                            sender.send(message, pushInfo.registrationToken, function(err, result) {
                                if (err) {
                                    var insert = "INSERT INTO result_log (content, job_id) " +
                                        "VALUES (?, ?)";

                                    var resultLog = "GCM error";
                                    logger.log('error', err);

                                    connection.query(insert, [resultLog, jobId], function(err, result) {
                                        if (err) {
                                            connection.release();
                                            logger.log('error', err);
                                            logger.log('error', jobName + ' error result_log 처리 실패');
                                        } else {
                                            logger.log('info', result);
                                            logger.log('info', jobName + ' error result_log 처리 완료');
                                        }
                                    });
                                } else {
                                    var insert = "INSERT INTO result_log (content, job_id) " +
                                        "VALUES (?, ?)";

                                    if (result.results[0].message_id) {
                                        var resultLog = "push success - " + result.results[0].message_id;
                                        logger.log('info', result.results[0].message_id);
                                        logger.log('info', jobName + ' push 처리 완료');
                                    } else {
                                        var resultLog = "push error - " + result.results[0].error;
                                        logger.log('warn', result.results[0].error);
                                        logger.log('warn', jobName + ' push 처리 실패');
                                    }

                                    connection.query(insert, [resultLog, jobId], function(err, result) {
                                        if (err) {
                                            connection.release();
                                            logger.log('error', err);
                                            logger.log('error', jobName + ' success result_log 처리 실패');
                                        } else {
                                            logger.log('info', result);
                                            logger.log('info', jobName + ' success result_log 처리 완료');
                                        }

                                    });
                                }
                            });
                        });
                    });
                });

                //jobdb에 넣어주기
                var insert = "INSERT INTO job (job_name, reservation_id) " +
                    "VALUES (?, ?)";

                connection.query(insert, [jobName, reservationId], function(err, result) {
                    if (err) {
                        cb(err);
                    } else {
                        var jobId = result.insertId;
                        var resultLog = "generate job";

                        var insert = "INSERT INTO result_log (content, job_id) " +
                                     "VALUES (?, ?)";

                        connection.query(insert, [resultLog, jobId], function(err, result) {
                            if (err) {
                                logger.log('error', err);
                                logger.log('error', jobName + ' add result_log 처리 에러');
                                cb(err);
                            } else {
                                logger.log('info', result);
                                logger.log('info', jobName + ' add result_log 처리 완료');
                            }

                        });
                        cb(null);
                    }
                });

            }, function(err) {
                if (err) {
                    connection.release();
                    var err = new Error('신규 스케쥴 등록에 실패하였습니다.');
                    err.code = 'E0015a';
                    callback(err);
                } else {
                    callback(null, connection, pushInfo);
                }
            });

        } else {

            function cancelJob (innercallback) {
                //job name 조회하기
                function getJobName(cb) {
                    var select = "SELECT job_name " +
                        "FROM job " +
                        "WHERE reservation_id = ?";

                    connection.query(select, [reservationId], function(err, results) {
                        if (err) {
                            cb(err);
                        } else {
                            var jobs = results;
                            cb(null, jobs);
                        }
                    });
                }

                // job 취소하기
                function cancelJob(jobs, cb) {

                    async.each(jobs, function(job, innercb) {
                        var jobName = job.job_name;
                        var selectedJob = nodeschedule.scheduledJobs[jobName];
                        selectedJob.cancel();
                        delete nodeschedule.scheduledJobs[jobName];

                        innercb(null);
                    }, function(err) {
                        if (err) {
                            cb(err);
                        } else {
                            cb(null, jobs);
                        }
                    });
                }

                async.waterfall([getJobName, cancelJob], function(err, jobs) {
                    if (err) {
                        var err = new Error('스케쥴 취소에 실패하였습니다.');
                        err.code = 'E0015b';
                        innercallback(err);
                    } else {
                        innercallback(null, jobs);
                    }
                });
            }

            function updateOrDeleteJob (jobs, innercallback) {
                if (pushInfo.reservationState === 3 ) {
                    connection.beginTransaction(function(err) {
                        if (err) {
                            innercallback(err);
                        } else {

                            function regenJob(cb) {
                                var message = new gcm.Message();
                                message.addData('title', title);


                                //예약 시간 전 알림해주기
                                async.eachSeries([pushInfo.before60, pushInfo.before35], function(beforeTime, innercb) {
                                    var info = '';
                                    var time = '';
                                    if (beforeTime === pushInfo.before60) {
                                        info = '60분 전 입니다. 감사합니다.';
                                        time = 'B60';
                                    } else {
                                        info = '35분 전 입니다. 예약 취소가 불가능 합니다.';
                                        time = 'B35';
                                    }
                                    var jobName = time + '-' + uuid.v4();
                                    var job = nodeschedule.scheduleJob(jobName, beforeTime, function() {
                                        pool.getConnection(function(err, connection) {

                                            var content = pushInfo[time] + ' ' + pushInfo.restaurantName + ' 예약 시간 ' + info;
                                            message.addData('message', content);

                                            var select = "SELECT job_id " +
                                                "FROM job " +
                                                "WHERE job_name = ?";

                                            connection.query(select, [jobName], function(err, results) {
                                                var jobId = results[0].job_id;
                                                sender.send(message, pushInfo.registrationToken, function(err, result) {
                                                    if (err) {
                                                        var insert = "INSERT INTO result_log (content, job_id) " +
                                                            "VALUES (?, ?)";

                                                        var resultLog = "GCM error";
                                                        logger.log('error', err);
                                                        connection.query(insert, [resultLog, jobId], function(err, result) {
                                                            if (err) {
                                                                connection.release();
                                                                logger.log('error', err);
                                                                logger.log('error', jobName + ' error result_log 처리 실패');
                                                            } else {
                                                                logger.log('info', result);
                                                                logger.log('info', jobName + ' error result_log 처리 완료');
                                                            }
                                                        });
                                                    }  else {
                                                        var insert = "INSERT INTO result_log (content, job_id) " +
                                                            "VALUES (?, ?)";

                                                        if (result.results[0].message_id) {
                                                            var resultLog = "push success - " + result.results[0].message_id;
                                                            logger.log('info', result.results[0].message_id);
                                                            logger.log('info', jobName + ' push 처리 완료');
                                                        } else {
                                                            var resultLog = "push error - " + result.results[0].error;
                                                            logger.log('warn', result.results[0].error);
                                                            logger.log('warn', jobName + ' push 처리 실패');
                                                        }

                                                        connection.query(insert, [resultLog, jobId], function(err, result) {
                                                            if (err) {
                                                                connection.release();
                                                                logger.log('error', err);
                                                                logger.log('error', jobName + ' success result_log 처리 실패');
                                                            } else {
                                                                logger.log('info', result);
                                                                logger.log('info', jobName + ' success result_log 처리 완료');
                                                            }


                                                        });
                                                    }
                                                });
                                            });
                                        });
                                    });

                                    var select = "SELECT job_id, job_name " +
                                        "         FROM job " +
                                        "         WHERE reservation_id = ?";

                                    connection.query(select, [reservationId], function(err, results) {
                                       if (err) {
                                           innercb(err);
                                       } else {
                                           var beforeJobName = results[0].job_name;
                                           var jobId = results[0].job_id;

                                           //jobdb에 넣어주기
                                           var update = "UPDATE job " +
                                                        "SET job_name = ? " +
                                                        "WHERE reservation_id = ? and job_name = ?";

                                           connection.query(update, [jobName, reservationId, beforeJobName], function(err, result) {
                                               if (err) {
                                                   innercb(err);
                                               } else {
                                                   var resultLog = "regenerate job";

                                                   var insert = "INSERT INTO result_log (content, job_id) " +
                                                       "VALUES (?, ?)";

                                                   connection.query(insert, [resultLog, jobId], function(err) {
                                                       if (err) {
                                                           logger.log('error', err);
                                                           logger.log('error', jobName + ' add result_log 처리 에러');
                                                           cb(err);
                                                       } else {
                                                           logger.log('info', result);
                                                           logger.log('info', jobName + ' add result_log 처리 완료');
                                                       }

                                                   });
                                                   innercb(null);
                                               }
                                           });
                                       }
                                    });

                                }, function(err) {
                                    if (err) {
                                        connection.rollback();
                                        connection.release();
                                        var err = new Error('스케쥴 재등록에 실패하였습니다.');
                                        err.code = 'E0015c';
                                        cb(err);
                                    } else {
                                        cb(null);
                                    }
                                });
                            }

                            function updateReservationState(cb) {
                                var update = "UPDATE reservation " +
                                             "SET reservation_state = 0 " +
                                             "WHERE reservation_id = ?";
                                connection.query(update, [reservationId], function(err) {
                                    if (err) {
                                        connection.rollback();
                                        connection.release();
                                        cb(err);
                                    } else {
                                        connection.commit();
                                        connection.release();
                                        cb(null);
                                    }
                                });
                            }

                            async.series([regenJob, updateReservationState], function(err) {
                               if (err) {
                                   innercallback(err);
                               } else {
                                   innercallback(null);
                               }
                            });

                        }
                    });
                } else {
                    connection.beginTransaction(function(err) {
                        if (err) {
                            innercallback(err);
                        } else {
                            async.eachSeries(jobs, function(job, innercb) {
                                var jobName = job.job_name;

                                var select = "SELECT job_id " +
                                    "FROM job " +
                                    "WHERE job_name = ?";

                                connection.query(select, [jobName], function(err, results) {
                                    var jobId = results[0].job_id;

                                    var deletelog = "DELETE " +
                                        "FROM result_log " +
                                        "WHERE job_id = ?";

                                    connection.query(deletelog, [jobId], function(err, result) {
                                        if (err) {
                                            connection.rollback();
                                            connection.release();
                                            logger.log('error', err);
                                            logger.log('error', jobName + ' delete result_log 처리 에러');
                                            innercb(err);
                                        }
                                        logger.log('info', result);
                                        logger.log('info', jobName + ' delete result_log 처리 완료');
                                    });

                                    var deletejob = "DELETE " +
                                        "FROM job " +
                                        "WHERE job_id = ?";

                                    connection.query(deletejob, [jobId], function(err, result) {
                                        if (err) {
                                            connection.rollback();
                                            connection.release();
                                            logger.log('error', err);
                                            logger.log('error', jobName + ' delete job 처리 에러');
                                            innercb(err);
                                        }
                                        logger.log('info', result);
                                        logger.log('info', jobName + ' delete job 처리 완료');
                                    });

                                });
                                innercb(null);
                            }, function(err) {
                                if (err) {
                                    var err = new Error('스케쥴 삭제에 실패하였습니다.');
                                    err.code = 'E0015d';
                                    innercallback(err);
                                } else {
                                    connection.commit();
                                    connection.release();
                                    innercallback(null);
                                }
                            });
                        }
                    });
                }
            }

            async.waterfall([cancelJob, updateOrDeleteJob], function(err) {
                if (err) {
                    callback(err);
                } else {
                    callback(null);
                }
            });

        }
    }


    async.waterfall([getConnection, selectReservationState, generateJob], function(err) {
        if (err) {
            next(err);
        } else {
            var results = {
                "result": {
                    "message": "스케쥴 등록이 정상적으로 처리되었습니다."
                }
            };
            res.json(results);
        }
    });

});


module.exports = router;