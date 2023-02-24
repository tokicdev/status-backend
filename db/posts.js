const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { DBGetUserInfo, DBAddUserPost, DBDeleteUserPost, DBGetAllPostIDs, DBGetUserFollowing } = require('./accounts.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();


const USER = process.env.DB_USER, PASS = process.env.DB_PASS, HOST = process.env.DB_HOST;
let connready = false;

//----------------------------------------------------//

const conn = mongoose.createConnection("mongodb+srv://" + USER + ":" + PASS + "@" + HOST + "/posts?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true
},
function(err) {
    if (err) {
        mongoose.disconnect();
        throw new Error("couldn't connect to the database (DB:'posts')");
    }
    else connready = true;
});

//----------------------------------------------------//

const Post = new Schema({
    userid: String,
    message: String,
    timestamp: Number,
    attach: [String],
    likes: [String],
    comments: [{
        userid: String,
        comment: String,
        timestamp: Number,
        likes: [String],
        numlikes: Number
    }],
    numlikes: Number,
    numcomments: Number
});

Post.pre('save', function(next) {

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

exports.DBAddPost = (username, data) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'posts')"));

        if (!Array.isArray(data.attach)) data.attach = undefined;
        else if (data.attach.length === 0) data.attach = undefined;

        const model = conn.model("posts", Post);
        model.create({
            userid: username, // insert a normal username and covnvert it into userid inside "Post.pre" callback
            message: data.message,
            timestamp: new Date().getTime(),
            numlikes: 0,
            numcomments: 0
        },
        function (err, doc) {
            if (err) return reject(new Error("couldn't insert data (DB:'posts')"));
            else {
                if (data.attach !== undefined) {
                    for (let i = 0; i < data.attach.length; i++) {
                        let base64Data, ext;
                        if (data.attach[i].startsWith("data:image/png;base64,")) {
                            base64Data = data.attach[i].slice(21);
                            ext = ".png";
                        }
                        else if (data.attach[i].startsWith("data:image/jpeg;base64,")) {
                            base64Data = data.attach[i].slice(22);
                            ext = ".jpeg";
                        }
                        else if (data.attach[i].startsWith("data:image/gif;base64,")) {
                            base64Data = data.attach[i].slice(21);
                            ext = ".gif";
                        }
                        else {
                            for (let j = 0; j < 3; j++) {
                                if (fs.existsSync("public/post/" + doc.id + "_" + j + ".png")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".png");
                                else if (fs.existsSync("public/post/" + doc.id + "_" + j + ".jpeg")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".jpeg");
                                else if (fs.existsSync("public/post/" + doc.id + "_" + j + ".gif")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".gif");
                            }
                            doc.remove();
                            return reject(new Error("attachments must be a .png, .jpg, .jpeg or .gif format image encoded in a base64 string"));
                        }

                        try {
                            fs.writeFileSync("public/post/" + doc.id + "_" + i + ext, base64Data, 'base64');
                        } catch (terr) {
                            for (let j = 0; j < 3; j++) {
                                if (fs.existsSync("public/post/" + doc.id + "_" + j + ".png")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".png");
                                else if (fs.existsSync("public/post/" + doc.id + "_" + j + ".jpeg")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".jpeg");
                                else if (fs.existsSync("public/post/" + doc.id + "_" + j + ".gif")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".gif");
                            }
                            doc.remove();
                            console.log(terr);

                            return reject(new Error("failed to save the attachments to the storage"));
                        }

                        doc.attach[i] = "/static/post/" + doc.id + "_" + i + ext;
                        if ((i+1) >= data.attach.length) {
                            doc.save().then(() => {
                                DBAddUserPost(doc.userid, doc.id).then(() => {
                                    return resolve(doc.id);
                                },
                                (derr) => {
                                    for (let j = 0; j < 3; j++) {
                                        if (fs.existsSync("public/post/" + doc.id + "_" + j + ".png")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".png");
                                        else if (fs.existsSync("public/post/" + doc.id + "_" + j + ".jpeg")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".jpeg");
                                        else if (fs.existsSync("public/post/" + doc.id + "_" + j + ".gif")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".gif");
                                    }
                                    doc.remove();
                                    return reject(derr);
                                });
                            });
                        }
                    }
                }
                else {
                    DBAddUserPost(doc.userid, doc.id).then(() => {
                        return resolve(doc.id);
                    },
                    (derr) => {
                        doc.remove();
                        return reject(derr);
                    });
                }
            }
        });
    });
};

exports.DBGetPost = (id, username = undefined) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'posts')"));
         
        const model = conn.model("posts", Post);
        model.findById(id, username === undefined ? '-likes -comments' : '-comments', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the requested post"));
            else {
                DBGetUserInfo(doc.userid, 2).then((userinfo) => {
                    if (userinfo === undefined) return reject(new Error("couldn't find the post author's account"));
                    DBGetUserInfo(username, 1).then((selfinfo) => {
                        let isliked;
                        if (username === undefined || selfinfo === undefined) isliked = undefined;
                        else if (doc.likes.indexOf(selfinfo.id) === -1) isliked = false;
                        else isliked = true;

                        return resolve({
                            // user info
                            username: userinfo.username,
                            fullname: userinfo.fullname,
                            checkmark: userinfo.checkmark,
                            avatar: userinfo.avatar,
                            // self info
                            isliked: isliked,
                            // post info
                            postid: doc.id,
                            message: doc.message,
                            timestamp: doc.timestamp,
                            attach: doc.attach,
                            numlikes: doc.numlikes,
                            numcomments: doc.numcomments
                        });
                    }, (err) => reject(err));
                }, (err) => reject(err));
            }
        });
    });
}

exports.DBGetAllPosts = (targetuser, username = undefined) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'posts')"));

        DBGetAllPostIDs(targetuser).then((postids) => {
         
            const model = conn.model("posts", Post);
            
            if (postids.length === 0) return resolve([]);

            DBGetUserInfo(username, 1).then((selfinfo) => {
                let retval = [], count = 0, validcount = postids.length;
                for (let i = 0; i < postids.length; i++) {
                    if (typeof postids[i] !== "string") return reject(new Error("one of the post IDs has the wrong data type (post ID: '" + postids[i] + "')"));
                    model.findById(postids[i], username === undefined ? '-likes -comments' : '-comments', function (err, doc) {
                        if (err) return reject(new Error("couldn't find one of the posts (post ID: '" + postids[i] + "')"));
                        else if (doc === undefined || doc === null) {
                            validcount--;
                            const postid = postids[i];
                            DBGetUserInfo(targetuser, 1).then((targetinfo) => {
                                DBDeleteUserPost(targetinfo.id, postid);
                            });
                        }
                        else {
                            DBGetUserInfo(doc.userid, 2).then((userinfo) => {
                                if (userinfo === undefined) return reject(new Error("couldn't find the author's account for one of the posts"));
                                
                                let isliked;
                                if (username === undefined || selfinfo === undefined) isliked = undefined;
                                else if (doc.likes.indexOf(selfinfo.id) === -1) isliked = false;
                                else isliked = true;

                                retval.push({
                                    // user info
                                    username: userinfo.username,
                                    fullname: userinfo.fullname,
                                    checkmark: userinfo.checkmark,
                                    avatar: userinfo.avatar,
                                    // self info
                                    isliked: isliked,
                                    // post info
                                    postid: doc.id,
                                    message: doc.message,
                                    timestamp: doc.timestamp,
                                    attach: doc.attach,
                                    numlikes: doc.numlikes,
                                    numcomments: doc.numcomments
                                });
                                count++;
                                if (validcount === count) {
                                    retval.sort((a, b) => {
                                        var result = (a["timestamp"] < b["timestamp"]) ? -1 : (a["timestamp"] > b["timestamp"]) ? 1 : 0;
                                        return result * -1;
                                    });

                                    return resolve(retval);
                                }
                            }, (err) => reject(err));
                        }
                    });
                }
            }, (err) => reject(err));
        }, (err) => reject(err));
    });
}

exports.DBAddPostComment = (username, data) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'posts')"));
        
        const model = conn.model("posts", Post);
        model.findById(data.postid, function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the specified post"));
            else {
                DBGetUserInfo(username, 1).then((userinfo) => {
                    doc.comments.push({ userid: userinfo.id, comment: data.comment, timestamp: new Date().getTime(), numlikes: 0 });
                    doc.numcomments = doc.comments.length;
                    doc.save().then(() => resolve(1));
                }, (err) => reject(err));
            }
        });
    });
}

exports.DBGetPostComments = (postid, username = undefined) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'posts')"));
        
        const model = conn.model("posts", Post);
        model.findById(postid, '-likes', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the specified post"));
            else {
                if (doc.comments.length === 0) return resolve([]);
                DBGetUserInfo(username, 1).then((selfinfo) => {
                    let retval = [], count = 0;
                    for (let i = 0; i < doc.comments.length; i++) {
                        DBGetUserInfo(doc.comments[i].userid, 2).then((userinfo) => {
                            if (userinfo === undefined) return reject(new Error("couldn't find the author's account for one of the comments"));
                            
                            let isliked;
                            if (username === undefined || selfinfo === undefined) isliked = undefined;
                            else if (doc.comments[i].likes.indexOf(selfinfo.id) === -1) isliked = false;
                            else isliked = true;

                            retval[i] = {
                                // user info
                                username: userinfo.username,
                                fullname: userinfo.fullname,
                                avatar: userinfo.avatar,
                                checkmark: userinfo.checkmark,
                                // self info
                                isliked: isliked,
                                // comment info
                                commentid: doc.comments[i].id,
                                comment: doc.comments[i].comment,
                                timestamp: doc.comments[i].timestamp,
                                numlikes: doc.comments[i].numlikes
                            };
                            count++;
                            if (doc.comments.length === count) {
                                retval.reverse();
                                return resolve(retval);
                            }
                        }, (err) => reject(err));
                    }
                }, (err) => reject(err));
            }
        });
    });
}

exports.DBLikePost = (username, data) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'posts')"));
        
        const model = conn.model("posts", Post);
        model.findById(data.postid, '-comments', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the specified post"));
            else {
                DBGetUserInfo(username, 1).then((userinfo) => {
                    if (data.like) {
                        if (doc.likes.indexOf(userinfo.id) === -1) {
                            doc.likes.push(userinfo.id);
                            doc.numlikes = doc.likes.length;
                            doc.save().then(() => resolve(1));
                        }
                        else return reject(new Error("the post is liked already, you can't like it again"));
                    }
                    else {
                        if (doc.likes.indexOf(userinfo.id) > -1) {
                            doc.likes.splice(doc.likes.indexOf(userinfo.id), 1);
                            doc.numlikes = doc.likes.length;
                            doc.save().then(() => resolve(1));
                        }
                        else return reject(new Error("the post isn't liked already, you can't unlike it"));
                    }
                }, (err) => reject(err));
            }
        });
    });
}

exports.DBLikeComment = (username, data) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'posts')"));
        
        const model = conn.model("posts", Post);
        model.findById(data.postid, '-likes', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the specified post"));
            else {
                DBGetUserInfo(username, 1).then((userinfo) => {
                    let cid;
                    for (let i = 0; i < doc.comments.length; i++) {
                        if (doc.comments[i].id === data.commentid) {
                            cid = i;
                            break;
                        }
                        else continue;
                    }
                    if (cid === undefined) return reject(new Error("couldn't find the specified comment"));


                    if (data.like) {
                        if (doc.comments[cid].likes.indexOf(userinfo.id) === -1) {
                            doc.comments[cid].likes.push(userinfo.id);
                            doc.comments[cid].numlikes = doc.comments[cid].likes.length;
                            doc.save().then(() => resolve(1));
                        }
                        else return reject(new Error("the comment is liked already, you can't like it again"));
                    }
                    else {
                        if (doc.comments[cid].likes.indexOf(userinfo.id) > -1) {
                            doc.comments[cid].likes.splice(doc.comments[cid].likes.indexOf(userinfo.id), 1);
                            doc.comments[cid].numlikes = doc.comments[cid].likes.length;
                            doc.save().then(() => resolve(1));
                        }
                        else return reject(new Error("the comment isn't liked already, you can't unlike it"));
                    }
                }, (err) => reject(err));
            }
        });
    });
}

exports.DBGetHomePosts = (username) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'posts')"));
        
        DBGetUserFollowing(username).then((following) => {
            const time = new Date().getTime() - 259200000; // 3 days
            const model = conn.model("posts", Post);
            model.find({ timestamp: { $gt: time }, userid: { $in: following } }, '-comments', function (err, docs) {
                if (err || docs === undefined || docs === null) return reject(new Error("couldn't find any posts"));
                else {
                    if (docs.length === 0) return resolve([]);
                    DBGetUserInfo(username, 1).then((selfinfo) => {
                        let retval = [], count = 0;
                        for (let i = 0; i < docs.length; i++) {
                            DBGetUserInfo(docs[i].userid, 2).then((userinfo) => {
                                if (userinfo === undefined) return reject(new Error("couldn't find the author's account for one of the posts"));
                                    
                                let isliked;
                                if (docs[i].likes.indexOf(selfinfo.id) === -1) isliked = false;
                                else isliked = true;

                                retval[i] = {
                                    // user info
                                    username: userinfo.username,
                                    fullname: userinfo.fullname,
                                    checkmark: userinfo.checkmark,
                                    avatar: userinfo.avatar,
                                    // self info
                                    isliked: isliked,
                                    // post info
                                    postid: docs[i].id,
                                    message: docs[i].message,
                                    timestamp: docs[i].timestamp,
                                    attach: docs[i].attach,
                                    numlikes: docs[i].numlikes,
                                    numcomments: docs[i].numcomments
                                };
                                count++;
                                if (docs.length === count) {
                                    retval.reverse();
                                    return resolve(retval);
                                }
                                
                            }, (err) => reject(err));
                        }
                    }, (err) => reject(err));
                }
            });
        }, (err) => reject(err));
    });
}

exports.DBEditPost = (username, data) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'posts')"));

        DBGetUserInfo(username, 1).then((userinfo) => {
            if (userinfo === undefined) return reject(new Error("there was an error on the server (DB:'posts')"));

            const model = conn.model("posts", Post);
            model.findById(data.postid, "-likes -comments", function (err, doc) {
                if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the specified post"));
                if (userinfo.id !== doc.userid) return reject(new Error("you are not this post's author"));

                doc.message = data.message;
                doc.save().then(() => resolve(1));
            });
        }, (err) => reject(err));
    });
}

exports.DBDeletePost = (username, postid) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'posts')"));

        DBGetUserInfo(username, 1).then((userinfo) => {
            if (userinfo === undefined) return reject(new Error("there was an error on the server (DB:'posts')"));

            const model = conn.model("posts", Post);
            model.findById(postid, "userid attach", function (err, doc) {
                if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the specified post"));
                if (userinfo.id !== doc.userid) return reject(new Error("you are not this post's author"));

                DBDeleteUserPost(userinfo.id, postid).then(() => {
                    if (doc.attach !== undefined && doc.attach.length > 0) {
                        for (let j = 0; j < 3; j++) {
                            if (fs.existsSync("public/post/" + doc.id + "_" + j + ".png")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".png");
                            else if (fs.existsSync("public/post/" + doc.id + "_" + j + ".jpeg")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".jpeg");
                            else if (fs.existsSync("public/post/" + doc.id + "_" + j + ".gif")) fs.unlinkSync("public/post/" + doc.id + "_" + j + ".gif");
                        }
                    }

                    doc.remove().then(() => resolve(1));
                }, (err) => reject(err));
            });
        }, (err) => reject(err));
    });
}