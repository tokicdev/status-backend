const mongoose = require('mongoose');
const { DBGetUserInfo } = require('./accounts');
const { DBGetPost, DBGetPostComments } = require('./posts');
const Schema = mongoose.Schema;
require('dotenv').config();

const USER = process.env.DB_USER, PASS = process.env.DB_PASS, HOST = process.env.DB_HOST;
let connready = false;

//----------------------------------------------------//

const conn = mongoose.createConnection("mongodb+srv://" + USER + ":" + PASS + "@" + HOST + "/reports?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true
},
function(err) {
    if (err) {
        mongoose.disconnect();
        throw new Error("couldn't connect to the database (DB:'reports')");
    }
    else connready = true;
});

//----------------------------------------------------//

const Report = new Schema({
    reportedaccount: String,
    reportedpost: String,
    reportedcomment: String,
    category: String,
    userid: String,
    message: String,
    timestamp: Number
});

Report.pre('save', function(next) {

    let tdata = this;

    if (tdata.isModified('userid')) {
        DBGetUserInfo(tdata.userid, 1).then((userinfo) => {
            tdata.userid = userinfo.id;
            return next();
        }, (err) => next(err));
    }
    else return next();
});

//----------------------------------------------------//

exports.DBAddReport = (username, type, data) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'reports')"));

        if (type === 0) {
            DBGetUserInfo(data.username, 1).then((userinfo) => {
                checkIsReported(username, type, userinfo.id).then(() => {
                    if (userinfo === undefined) return reject(new Error("couldn't find the specified user"));
                    createReport(type, userinfo.id, username, data.message).then(() => resolve(1), (err) => reject(err));
                }, (err) => reject(err));
            }, (err) => reject(err));
        }
        else if (type === 1) {
            checkIsReported(username, type, data.postid).then(() => {
                DBGetPost(data.postid).then((post) => {
                    if (post !== undefined && post.postid === data.postid) {
                        createReport(type, data.postid, username, data.message).then(() => resolve(1), (err) => reject(err));
                    }
                }, (err) => reject(err));
            }, (err) => reject(err));
        }
        else if (type === 2) {
            checkIsReported(username, type, data.postid, data.commentid).then(() => {
                DBGetPostComments(data.postid).then((comments) => {
                    if (comments === undefined || comments.length === 0) return reject(new Error("couldn't find the specified comment"));
                    let ex = false;
                    for (let i = 0; i < comments.length; i++) {
                        if (data.commentid === comments[i].commentid) {
                            createReport(type, data.postid, username, data.message, data.commentid).then(() => resolve(1), (err) => reject(err));
                            ex = true;
                            break;
                        }
                        else continue;
                    }
                    if (!ex) return reject(new Error("couldn't find the specified comment"));
                }, (err) => reject(err));
            }, (err) => reject(err));
        }
        else if (type === 3) {
            if (data.category !== "homepage" && data.category !== "profile" && data.category !== "settings" && data.category !== "other") {
                return reject(new Error("the category is invalid, choose one of these 'homepage', 'profile', 'settings', 'other'"));
            }

            checkIsReported(username, type, undefined, undefined, data.message).then(() => {
                createReport(type, undefined, username, data.message, undefined, data.category).then(() => resolve(1), (err) => reject(err));          
            }, (err) => reject(err));
        }
    });

    function createReport (type, conid, username, message, commid, category) {
        return new Promise((resolve, reject) => {
            if (type === 0) {
                const model = conn.model("account", Report);
                model.create({
                    reportedaccount: conid,
                    userid: username, // insert a normal username and covnvert it into userid inside "Report.pre" callback
                    message: message,
                    timestamp: new Date().getTime()
                },
                function (err, doc) {
                    if (err) return reject(new Error("couldn't insert data (DB:'reports')"));
                    else return resolve(1);
                });
            }
            else if (type === 1) {
                const model = conn.model("post", Report);
                model.create({
                    reportedpost: conid,
                    userid: username,
                    message: message,
                    timestamp: new Date().getTime()
                },
                function (err, doc) {
                    if (err) return reject(new Error("couldn't insert data (DB:'reports')"));
                    else return resolve(1);
                });
            }
            else if (type === 2) {
                const model = conn.model("comment", Report);
                model.create({
                    reportedpost: conid,
                    reportedcomment: commid,
                    userid: username,
                    message: message,
                    timestamp: new Date().getTime()
                },
                function (err, doc) {
                    if (err) return reject(new Error("couldn't insert data (DB:'reports')"));
                    else return resolve(1);
                });
            }
            else if (type === 3) {
                const model = conn.model("bug", Report);
                model.create({
                    category: category,
                    userid: username,
                    message: message,
                    timestamp: new Date().getTime()
                },
                function (err, doc) {
                    if (err) return reject(new Error("couldn't insert data (DB:'reports')"));
                    else return resolve(1);
                });
            }
        });
    }

    function checkIsReported (username, type, conid, commid, message) {
        return new Promise((resolve, reject) => {
            DBGetUserInfo(username, 1).then((userinfo) => {
                if (userinfo === undefined) return reject(new Error("an error occured on the server (DB: 'reports')"))
                if (type === 0) {
                    const model = conn.model("account", Report);

                    model.findOne({ userid: userinfo.id, reportedaccount: conid }, function (err, doc) {
                        if (err || doc === undefined || doc === null) return resolve(1);
                        else return reject(new Error("you already reported this account"));
                    });
                }
                else if (type === 1) {
                    const model = conn.model("post", Report);

                    model.findOne({ userid: userinfo.id, reportedpost: conid }, function (err, doc) {
                        if (err || doc === undefined || doc === null) return resolve(1);
                        else return reject(new Error("you already reported this post"));
                    });
                }
                else if (type === 2) {
                    const model = conn.model("comment", Report);

                    model.findOne({ userid: userinfo.id, reportedpost: conid, reportedcomment: commid }, function (err, doc) {
                        if (err || doc === undefined || doc === null) return resolve(1);
                        else return reject(new Error("you already reported this comment"));
                    });
                }
                else if (type === 3) {
                    const model = conn.model("bug", Report);

                    model.findOne({ userid: userinfo.id, message: message }, function (err, doc) {
                        if (err || doc === undefined || doc === null) return resolve(1);
                        else return reject(new Error("you already made an identical report"));
                    });
                }
            }, (err) => reject(err));
        });
    }
};