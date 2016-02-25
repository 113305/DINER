var config = {
    "host": process.env.DINER_DB_SERVER,
    "port": process.env.DINER_DB_PORT,
    "user": process.env.DINER_DB_USERNAME,
    "password": process.env.DINER_DB_PASSWORD,
    "database": process.env.DINER_DB,
    "ssl": "Amazon RDS",
    "debug": true
}


module.exports = config;