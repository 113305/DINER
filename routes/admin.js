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
                    "before60": results[0].before_60m
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
            message.addNotification("title", "DINER");
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

                        var content = pushInfo.dateTime + pushInfo.restaurantName + ' 예약 시간 ' + info;
                        message.addNotification("body", content);

                        var select = "SELECT job_id " +
                            "FROM job " +
                            "WHERE job_name = ?";

                        connection.query(select, [jobName], function(err, results) {
                            var jobId = results[0].job_id;
                            sender.send(message, pushInfo.registrationToken, function(err, result) {
                                if (err) {
                                    var insert = "INSERT INTO result_log (content, job_id) " +
                                        "VALUES (?, ?)";

                                    var content = "push error";

                                    connection.query(insert, [content, jobId], function(err, result) {
                                        if (err) {
                                            connection.release();
                                            console.log(jobName + ' error result_log 처리 실패');
                                        } else {
                                            console.log(jobName + ' error result_log 처리 완료');
                                        }
                                    });
                                }  else {
                                    var insert = "INSERT INTO result_log (content, job_id) " +
                                        "VALUES (?, ?)";

                                    var content = "push success";

                                    connection.query(insert, [content, jobId], function(err, result) {
                                        if (err) {
                                            connection.release();
                                            console.log(jobName + ' success result_log 처리 실패');
                                        } else {
                                            console.log(jobName + ' success result_log 처리 완료');
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
                        var content = "generate job";

                        var insert = "INSERT INTO result_log (content, job_id) " +
                                     "VALUES (?, ?)";

                        connection.query(insert, [content, jobId], function(err) {
                            if (err) {
                                cb(err);
                                console.log(jobName + ' add result_log 처리 에러');
                            } else {
                                console.log(jobName + ' add result_log 처리 완료');
                            }

                        });
                        cb(null);
                    }
                });

            }, function(err) {
                if (err) {
                    connection.release();
                    var err = new Error('신규 스케쥴 등록에 실패하였습니다.');
                    err.code = 'E0021a';
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
                        err.code = 'E0021b';
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
                                message.addNotification("title", "DINER");

                                console.log("infoinfo",pushInfo);
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

                                            var content = pushInfo.dateTime + pushInfo.restaurantName + ' 예약 시간 ' + info;
                                            message.addNotification("body", content);

                                            var select = "SELECT job_id " +
                                                "FROM job " +
                                                "WHERE job_name = ?";

                                            connection.query(select, [jobName], function(err, results) {
                                                var jobId = results[0].job_id;
                                                sender.send(message, pushInfo.registrationToken, function(err, result) {
                                                    if (err) {
                                                        var insert = "INSERT INTO result_log (content, job_id) " +
                                                            "VALUES (?, ?)";

                                                        var content = "push error";

                                                        connection.query(insert, [content, jobId], function(err, result) {
                                                            if (err) {
                                                                connection.release();
                                                                console.log(jobName + ' error result_log 처리 실패');
                                                            } else {
                                                                console.log(jobName + ' error result_log 처리 완료');
                                                            }
                                                        });
                                                    }  else {
                                                        var insert = "INSERT INTO result_log (content, job_id) " +
                                                            "VALUES (?, ?)";

                                                        var content = "push success";

                                                        connection.query(insert, [content, jobId], function(err, result) {
                                                            if (err) {
                                                                connection.release();
                                                                console.log(jobName + ' success result_log 처리 실패');
                                                            } else {
                                                                console.log(jobName + ' success result_log 처리 완료');
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
                                                   var content = "regenerate job";

                                                   var insert = "INSERT INTO result_log (content, job_id) " +
                                                       "VALUES (?, ?)";

                                                   connection.query(insert, [content, jobId], function(err) {
                                                       if (err) {
                                                           innercb(err);
                                                           console.log(jobName + ' add result_log 처리 에러');
                                                       } else {
                                                           console.log(jobName + ' add result_log 처리 완료');
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
                                        err.code = 'E0021c';
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
                                console.log("잡잡",jobs);
                                var jobName = job.job_name;

                                var select = "SELECT job_id " +
                                    "FROM job " +
                                    "WHERE job_name = ?";

                                connection.query(select, [jobName], function(err, results) {
                                    var jobId = results[0].job_id;

                                    var deletelog = "DELETE " +
                                        "FROM result_log " +
                                        "WHERE job_id = ?";

                                    connection.query(deletelog, [jobId], function(err) {
                                        if (err) {
                                            console.log(jobName + ' delete result_log 처리 실패');
                                            connection.rollback();
                                            connection.release();
                                            innercb(err);
                                        }
                                        console.log(jobName + ' delete result_log 처리 완료');
                                    });

                                    var deletejob = "DELETE " +
                                        "FROM job " +
                                        "WHERE job_id = ?";

                                    connection.query(deletejob, [jobId], function(err) {
                                        if (err) {
                                            console.log(jobName + ' delete job 처리 실패');
                                            connection.rollback();
                                            connection.release();
                                            innercb(err);
                                        }
                                        console.log(jobName + ' delete job 처리 완료');
                                    });

                                });
                                innercb(null);
                            }, function(err) {
                                if (err) {
                                    var err = new Error('스케쥴 삭제에 실패하였습니다.');
                                    err.code = 'E0021d';
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


    async.waterfall([getConnection, selectReservationState, generateJob], function(err, results) {
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