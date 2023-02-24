const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcrypt');
const saltRounds = 10;
const fs = require('fs');
require('dotenv').config();


const USER = process.env.DB_USER, PASS = process.env.DB_PASS, HOST = process.env.DB_HOST, TKEY = process.env.DB_TKEY;
let connready = false;

//----------------------------------------------------//

const conn = mongoose.createConnection("mongodb+srv://" + USER + ":" + PASS + "@" + HOST + "/accounts?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true
},
function(err) {
    if (err) {
        mongoose.disconnect();
        throw new Error("couldn't connect to the database (DB:'accounts')");
    }
    else connready = true;
});

//----------------------------------------------------//

const Account = new Schema({
    username: String,
    password: String,
    fullname: String,
    email: String,
    birthdate: String,
    token: String,
    regtimestamp: Number,
    checkmark: Boolean,
    avatar: String,
    posts: [String],
    followers: [String],
    following: [String],
    numfollowers: Number,
    numfollowing: Number
});

Account.pre('save', function(next) {

    if (this.isModified('followers')) this.numfollowers = this.followers.length;
    if (this.isModified('following')) this.numfollowing = this.following.length;
    
    if (this.isModified('password') || this.isModified('username')) {
        let tdata = this;
        const tpw = this.password;
        
        if (tdata.isModified('password')) {
            bcrypt.hash(tdata.password, saltRounds, function(err, hash) {
                if (err) return next(err);
                tdata.password = hash;

                bcrypt.hash(tdata.username + tpw + TKEY, saltRounds, function(err, hash) {
                    if (err) return next(err);
                    tdata.token = hash;
                    return next();
                });
            });
        }
        else {
            bcrypt.hash(tdata.username + tpw + TKEY, saltRounds, function(err, hash) {
                if (err) return next(err);
                tdata.token = hash;
                return next();
            });
        }
    }
    else return next();
});

Account.methods.comparePassword = function(candidatePassword, cb) {
    let tdata = this;
    bcrypt.compare(candidatePassword, tdata.password, function(err, isMatch) {
        if (err) return cb(err);
        cb(0, isMatch);
    });
};

//----------------------------------------------------//

exports.DBRegister = (data) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));

        const model = conn.model("accounts", Account);
        model.findOne({ username: data.username }, '-followers -following', function (err0, doc0) {
            if (err0 || doc0 === undefined || doc0 === null) {
                model.findOne({ email: data.email }, function (err1, doc1) {
                    if (err1 || doc1 === undefined || doc1 === null) {
                        if (data.fullname === null || data.fullname === "" || /^\s*$/.test(data.fullname)) data.fullname = undefined;
                        model.create({
                            username: data.username,
                            password: data.password,
                            fullname: data.fullname,
                            email: data.email,
                            birthdate: data.birthdate,
                            checkmark: false,
                            regtimestamp: new Date().getTime(),
                            numfollowers: 0,
                            numfollowing: 0
                        },
                        function (nerr, ndoc) {
                            if (nerr) return reject(new Error("couldn't insert data (DB:'accounts')"));
                            else {
                                if (data.avatar !== undefined) {
                                    let base64Data, ext;
                                    if (data.avatar.startsWith("data:image/png;base64,")) {
                                        base64Data = data.avatar.slice(21);
                                        ext = ".png";
                                    }
                                    else if (data.avatar.startsWith("data:image/jpeg;base64,")) {
                                        base64Data = data.avatar.slice(22);
                                        ext = ".jpeg";
                                    }
                                    else {
                                        ndoc.remove();
                                        return reject(new Error("the avatar must a .png, .jpg or .jpeg format image encoded in a base64 string"));
                                    }

                                    fs.writeFile("public/avatar/" + ndoc.id + ext, base64Data, 'base64', function(ferr) {
                                        if (ferr) {
                                            ndoc.remove();
                                            return reject(new Error("failed to save the avatar to the storage"));
                                        }
                                        else {
                                            ndoc.avatar = "/static/avatar/" + ndoc.id + ext;
                                            ndoc.save().then(() => resolve(ndoc.token));
                                        }
                                    });
                                }
                                else return resolve(ndoc.token);
                            }
                        });
                    }
                    else return reject (new Error("an account with that E-mail adress already exists!"));
                });
            }
            else return reject (new Error("an account with that username already exists!"));
        });
    });
};

exports.DBLogin = (username, password) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));

        const model = conn.model("accounts", Account);
        model.findOne({ username: username }, '-followers -following', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("incorrect username or password!"));
            else {
                doc.comparePassword(password, function(err, isMatch) {
                    if (err) return reject(new Error("an error occured on the server (DB:'accounts')"));
                    else {
                        if (isMatch) return resolve(doc.token);
                        else return reject(new Error("incorrect password!"));
                    }
                });
            }
        });
    });
};

exports.DBCheckToken = (username, token) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));

        const model = conn.model("accounts", Account);
        model.findOne({ username: username }, '-followers -following', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("you are not authorized!"));
            else {
                if (doc.token === token) return resolve(1);
                else return reject(new Error("you are not authorized!"));
            }
        });
    });
}

exports.DBGetUserInfo = (usernameorid, mode) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));

        const model = conn.model("accounts", Account);

        if (mode === 1) { // find by username
            model.findOne({ username: usernameorid }, '-followers -following', function (err, doc) {
                if (err || doc === undefined || doc === null) return resolve(undefined);
                else {
                    return resolve(retObj(doc));
                }
            });
        }
        else if (mode === 2) { // find by id
            model.findById(usernameorid, function (err, doc) {
                if (err || doc === undefined || doc === null) return resolve(undefined);
                else {
                    return resolve(retObj(doc));
                }
            });
        }
        else return reject(new Error("an error occured on the server (DB:'accounts')"));
    });

    function retObj(doc) {
        return ({
            id: doc.id,
            username: doc.username,
            fullname: doc.fullname,
            checkmark: doc.checkmark,
            avatar: doc.avatar,
            numfollowers: doc.numfollowers,
            numfollowing: doc.numfollowing
        });
    }
};

exports.DBAddUserPost = (userid, postid) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));

        const model = conn.model("accounts", Account);

        model.findById(userid, '-followers -following', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the post author's account"));
            else {
                doc.posts.push(postid);
                doc.save().then(() => resolve(1), () => reject(new Error("couldn't add the post to the user's account (DB: 'accounts')")));
            }
        });
    });
};

exports.DBDeleteUserPost = (userid, postid) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));

        const model = conn.model("accounts", Account);

        model.findById(userid, '-followers -following', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the post author's account"));
            else {
                const ind = doc.posts.indexOf(postid);
                if (ind === -1) return reject(new Error("couldn't find the specified post (DB: 'accounts')"));
                doc.posts.splice(ind, 1);
                doc.save().then(() => resolve(1), () => reject(new Error("couldn't remove the post from the user's account (DB: 'accounts')")));
            }
        });
    });
};

exports.DBGetAllPostIDs = (username) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));

        const model = conn.model("accounts", Account);

        model.findOne({ username: username }, '-followers -following', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the user's account"));
            else return resolve(doc.posts);
        });
    });
}

exports.DBFollowUser = (username, data) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));
        
        const model = conn.model("accounts", Account);
        model.findOne({ username: data.targetuser }, function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the specified target user"));
            else {
                model.findOne({ username: username }, function (serr, sdoc) {
                    if (serr) return reject(new Error("an error occured on the server (DB:'accounts')"));
                    else if (sdoc === undefined || sdoc === null) return reject(new Error("couldn't find your account"));
                    else {
                        if (doc.id === sdoc.id) return reject(new Error("you can't follow or unfollow yourself"));
                        if (data.follow) {
                            if (sdoc.numfollowing >= 1000) return reject(new Error("you can't follow any more users"));
                            if (sdoc.following.indexOf(doc.id) === -1 && doc.followers.indexOf(sdoc.id) === -1) {
                                sdoc.following.push(doc.id);
                                doc.followers.push(sdoc.id);
                                sdoc.numfollowing = sdoc.following.length;
                                doc.numfollowers = doc.followers.length;
                                sdoc.save().then(() => doc.save()).then(() => resolve(1));
                            }
                            else if (sdoc.following.indexOf(doc.id) > -1 && doc.followers.indexOf(sdoc.id) > -1) {
                                return reject(new Error("you already follow this user, you can't follow him again"));
                            }
                            else {
                                if (sdoc.following.indexOf(doc.id) > -1) sdoc.following.splice(sdoc.following.indexOf(doc.id), 1);
                                if (doc.followers.indexOf(sdoc.id) > -1) doc.followers.splice(doc.followers.indexOf(sdoc.id), 1);
                                sdoc.save().then(() => doc.save()).then(() => reject(new Error("an error occured on the server (DB:'accounts')")));
                            }
                        }
                        else {
                            if (sdoc.following.indexOf(doc.id) > -1 && doc.followers.indexOf(sdoc.id) > -1) {
                                sdoc.following.splice(sdoc.following.indexOf(doc.id), 1);
                                doc.followers.splice(doc.followers.indexOf(sdoc.id), 1);
                                sdoc.numfollowing = sdoc.following.length;
                                doc.numfollowers = doc.followers.length;
                                sdoc.save().then(() => doc.save()).then(() => resolve(1));
                            }
                            else if (sdoc.following.indexOf(doc.id) === -1 && doc.followers.indexOf(sdoc.id) === -1) {
                                return reject(new Error("you don't follow this user, you can't unfollow him"));
                            }
                            else {
                                if (sdoc.following.indexOf(doc.id) > -1) sdoc.following.splice(sdoc.following.indexOf(doc.id), 1);
                                if (doc.followers.indexOf(sdoc.id) > -1) doc.followers.splice(doc.followers.indexOf(sdoc.id), 1);
                                sdoc.save().then(() => doc.save()).then(() => reject(new Error("an error occured on the server (DB:'accounts')")));
                            }   
                        }
                    }
                });
            }
        });
        
    });
}

exports.DBRemoveFollower = (username, targetuser) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));
        
        const model = conn.model("accounts", Account);
        model.findOne({ username: targetuser }, 'following', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("couldn't find the target user"));
            else {
                model.findOne({ username: username }, 'followers', function (err2, doc2) {
                    if (err2 || doc2 === undefined || doc2 === null) return reject(new Error("an error occured on the server (DB:'accounts')"));
                    
                    const ind = doc.following.indexOf(doc2.id), ind2 = doc2.followers.indexOf(doc.id);
                    if (ind === -1 && ind2 === -1) return reject(new Error("this user isn't following you, you can't remove him"));
                    
                    if (ind !== -1) doc.following.splice(ind, 1);
                    if (ind2 !== -1) doc2.followers.splice(ind2, 1);
                    doc.save().then(() => doc2.save().then(() => resolve(1)));
                });
            }
        });
    });
}

exports.DBGetUserFollowing = (username) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));
        
        const model = conn.model("accounts", Account);
        model.findOne({ username: username }, '-followers', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("an error occured on the server (DB:'accounts')"));
            else return resolve(doc.following);
        });
    });
}

exports.DBSearchAccounts = (query) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));
        
        let results = [], count = 0;
        if (!/\w+\s+\w+/.test(query)) { // only one word
            query = query.replace(/ /g, "");
            if (query.length < 3) return reject(new Error("the query must be at least 3 characters long, excluding the unnecessary whitespaces"));

            searchAcc(query, "ex_user").then((doc1) => {
                if (doc1 !== undefined) {
                    results.push(doc1);
                    count++;
                }

                searchAcc(query, "ch_user").then((docs2) => {
                    if (docs2.length > 0) {
                        for (let i = 0; i < docs2.length; i++) {
                            if (results.find(element => element.id === docs2[i].id) !== undefined) continue;
                            results.push(docs2[i]);
                            count++;
                        }
                    }

                    searchAcc(query, "ch_full").then((docs3) => {
                        if (docs3.length > 0 && docs2.length < 3) {
                            let pushed = 0;
                            for (let i = 0; i < docs3.length; i++) {
                                if (pushed >= (3 - docs2.length)) break;
                                if (results.find(element => element.id === docs3[i].id) !== undefined) continue;
                                results.push(docs3[i]);
                                pushed++;
                                count++;
                            }
                        }

                        searchAcc(query, "user").then((docs4) => {
                            let remainu = 0, remainf = 0;
                            if (count < 10) {
                                if (((10 - count) / 2) % 1 !== 0) {
                                    remainu = Math.round((10 - count) / 2);
                                    remainf = Math.round((10 - count) / 2);
                                    if ((remainu + remainf) > (10 - count)) {
                                        remainf--;
                                    }
                                }
                                else {
                                    remainu = (10 - count) / 2;
                                    remainf = (10 - count) / 2;
                                }
                            }

                            if (docs4.length > 0 && remainu > 0) {
                                let upushed = 0;
                                for (let i = 0; i < docs4.length; i++) {
                                    if (upushed >= remainu) break;
                                    if (results.find(element => element.id === docs4[i].id) !== undefined) continue;
                                    results.push(docs4[i]);
                                    upushed++;
                                    count++;
                                }
                            }

                            searchAcc(query, "full").then((docs5) => {
                                if (docs5.length && remainf > 0) {
                                    let fpushed = 0;
                                    for (let i = 0; i < docs5.length; i++) {
                                        if (fpushed >= remainf) break;
                                        if (results.find(element => element.id === docs5[i].id) !== undefined) continue;
                                        results.push(docs5[i]);
                                        fpushed++;
                                        count++;
                                    }
                                }

                                let retval = [];
                                for (let i = 0; i < results.length; i++) {
                                    retval.push({
                                        username: results[i].username,
                                        fullname: results[i].fullname,
                                        avatar: results[i].avatar,
                                        checkmark: results[i].checkmark
                                    });
                                }
                                return resolve(retval);
                            });
                        });
                    });
                });
            });
        }
        else { // multiple words
            query = query.replace(/^\s+|\s+$/g, "");
            if (query.length < 3) return reject(new Error("the query must be at least 3 characters long, excluding the unnecessary whitespaces"));
            
            searchAcc(query, "ex_full").then((doc1) => {
                if (doc1 !== undefined) {
                    results.push(doc1);
                    count++;
                }

                searchAcc(query, "ch_full").then((docs2) => {
                    if (docs2.length > 0) {
                        for (let i = 0; i < docs2.length; i++) {
                            if (results.find(element => element.id === docs2[i].id) !== undefined) continue;
                            results.push(docs2[i]);
                            count++;
                        }
                    }

                    searchAcc(query, "full").then((docs3) => {
                        if (docs3.length > 0) {
                            let pushed = 0;
                            const remain = 10 - count;
                            for (let i = 0; i < docs3.length; i++) {
                                if (pushed >= remain) break;
                                if (results.find(element => element.id === docs3[i].id) !== undefined) continue;
                                results.push(docs3[i]);
                                count++;
                                pushed++;
                            }
                        }

                        let retval = [];
                        for (let i = 0; i < results.length; i++) {
                            retval.push({
                                username: results[i].username,
                                fullname: results[i].fullname,
                                avatar: results[i].avatar,
                                checkmark: results[i].checkmark
                            });
                        }
                        return resolve(retval);
                    });
                });
            });
        }
    });


    function searchAcc (query, by) {
        return new Promise((resolve, reject) => {
            const model = conn.model("accounts", Account);
            if (by === "ex_user") {
                model.findOne({ username: query }, 'username fullname avatar checkmark', function (err, doc) {
                    if (err || doc === undefined || doc === null) resolve(undefined);
                    else resolve(doc);
                });
            }
            else if (by === "ex_full") {
                model.findOne({ fullname: query }, 'username fullname avatar checkmark', function (err, doc) {
                    if (err || doc === undefined || doc === null) resolve(undefined);
                    else resolve(doc);
                });
            }
            else if (by === "ch_user") {
                model.find({ checkmark: true, username: { $regex: query, $options: "i" } }, 'username fullname avatar checkmark', function (err, docs) {
                    if (err || docs === undefined || docs === null || !Array.isArray(docs) || !docs.length) resolve([]);
                    else resolve(docs);
                }).limit(3);
            }
            else if (by === "ch_full") {
                model.find({ checkmark: true, fullname: { $regex: query, $options: "i" } }, 'username fullname avatar checkmark', function (err, docs) {
                    if (err || docs === undefined || docs === null || !Array.isArray(docs) || !docs.length) resolve([]);
                    else resolve(docs);
                }).limit(3);
            }
            else if (by === "user") {
                model.find({ username: { $regex: query, $options: "i" } }, 'username fullname avatar checkmark', function (err, docs) {
                    if (err || docs === undefined || docs === null || !Array.isArray(docs) || !docs.length) resolve([]);
                    else resolve(docs);
                }).limit(10);
            }
            else if (by === "full") {
                model.find({ fullname: { $regex: query, $options: "i" } }, 'username fullname avatar checkmark', function (err, docs) {
                    if (err || docs === undefined || docs === null || !Array.isArray(docs) || !docs.length) resolve([]);
                    else resolve(docs);
                }).limit(10);
            }
        });
    }
}

exports.DBGetProfile = (targetuser, username = undefined) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));
        
        const model = conn.model("accounts", Account);
        model.findOne({ username: targetuser }, '-followers -following -posts', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("the specified user not found"));
            else {
                if (username !== undefined) {
                    exports.DBGetUserFollowing(username).then((following) => {
                        if (following.indexOf(doc.id) !== -1) return resolve(retObj(doc, true));
                        else return resolve(retObj(doc, false));
                    }, (err) => reject(err));
                }
                else return resolve(retObj(doc, undefined));
            }
        });
    });

    function retObj (doc, isfollowing) {
        return ({
            // targetuser info
            username: doc.username,
            fullname: doc.fullname,
            birthdate: doc.birthdate,
            checkmark: doc.checkmark,
            avatar: doc.avatar,
            numfollowers: doc.numfollowers,
            numfollowing: doc.numfollowing,
            regtimestamp: doc.regtimestamp,
            // self info
            isfollowing: isfollowing
        });
    }
}

exports.DBGetProfileFollowers = (targetuser) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));
        
        const model = conn.model("accounts", Account);
        model.findOne({ username: targetuser }, 'followers', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("the specified user not found"));
            else {
                if (doc.followers.length === 0) return resolve([]);

                let retval = [], count = 0, total = doc.followers.length;
                for (let i = 0; i < doc.followers.length; i++) {
                    exports.DBGetUserInfo(doc.followers[i], 2).then((userinfo) => {
                        if (userinfo === undefined) total--;
                        else {
                            retval.push({
                                username: userinfo.username,
                                fullname: userinfo.fullname,
                                checkmark: userinfo.checkmark,
                                avatar: userinfo.avatar
                            });
                            count++;
                        }

                        if (count >= total) return resolve(retval);
                    }, (err) => reject(err));
                }
            }
        });
    });
}

exports.DBGetProfileFollowing = (targetuser) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));
        
        const model = conn.model("accounts", Account);
        model.findOne({ username: targetuser }, 'following', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("the specified user not found"));
            else {
                if (doc.following.length === 0) return resolve([]);

                let retval = [], count = 0, total = doc.following.length;
                for (let i = 0; i < doc.following.length; i++) {
                    exports.DBGetUserInfo(doc.following[i], 2).then((userinfo) => {
                        if (userinfo === undefined) total--;
                        else {
                            retval.push({
                                username: userinfo.username,
                                fullname: userinfo.fullname,
                                checkmark: userinfo.checkmark,
                                avatar: userinfo.avatar
                            });
                            count++;
                        }

                        if (count >= total) return resolve(retval);
                    }, (err) => reject(err));
                }
            }
        });
    });
}

exports.DBEditProfile = (username, data) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));
        
        const model = conn.model("accounts", Account);
        model.findOne({ username: username }, '-followers -following -posts', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("an error occured on the server (DB:'accounts')"));
            else {
                if (data.fullname !== undefined) {
                    if (!/^(?!.*[0-9]).{0,32}$/.test(data.fullname)) {
                        return reject(new Error("the full name can't be longer than 32 characters or contain numbers"));
                    }
                    else doc.fullname = data.fullname;
                }
                if (data.avatar !== undefined) {
                    let base64Data, ext;
                    if (data.avatar.startsWith("data:image/png;base64,")) {
                        base64Data = data.avatar.slice(21);
                        ext = ".png";
                    }
                    else if (data.avatar.startsWith("data:image/jpeg;base64,")) {
                        base64Data = data.avatar.slice(22);
                        ext = ".jpeg";
                    }
                    else {
                        return reject(new Error("the avatar must a .png, .jpg or .jpeg format image encoded in a base64 string"));
                    }

                    try {
                        fs.writeFileSync("public/avatar/" + doc.id + ext, base64Data, 'base64');
                    } catch (err) {
                        console.log(err);
                        return reject(new Error("failed to save the avatar to the storage"));
                    }

                    if (ext === ".jpeg" && fs.existsSync("public/avatar/" + doc.id + ".png")) fs.unlinkSync("public/avatar/" + doc.id + ".png");
                    else if (ext === ".png" && fs.existsSync("public/avatar/" + doc.id + ".jpeg")) fs.unlinkSync("public/avatar/" + doc.id + ".jpeg");
                    doc.avatar = "/static/avatar/" + doc.id + ext;
                }

                doc.save().then(() => resolve(1));
            }
        });
    });
}

exports.DBEditAccount = (username, mode, newdata) => {
    return new Promise((resolve, reject) => {
        if (!connready) return reject(new Error("the database isn't ready yet (DB:'accounts')"));
        
        const model = conn.model("accounts", Account);
        model.findOne({ username: username }, '-followers -following -posts', function (err, doc) {
            if (err || doc === undefined || doc === null) return reject(new Error("an error occured on the server (DB:'accounts')"));
            else {
                if (mode === 0) {
                    model.findOne({ username: newdata }, 'username', function (nerr, ndoc) {
                        if (nerr || ndoc === undefined || ndoc === null) {
                            doc.username = newdata;
                            doc.save().then(() => resolve(doc.token));
                        }
                        else return reject(new Error("an account with that username already exists!"));
                    });
                }
                else if (mode === 1) {
                    model.findOne({ email: newdata }, 'email', function (nerr, ndoc) {
                        if (nerr || ndoc === undefined || ndoc === null) {
                            doc.email = newdata;
                            doc.save().then(() => resolve(doc.token));
                        }
                        else return reject(new Error("an account with that E-mail already exists!"));
                    });
                }
                else if (mode === 2) {
                    doc.password = newdata;
                    doc.save().then(() => resolve(doc.token));
                }
                
            }
        });
    });
}