const { DBCheckToken, DBRegister, DBLogin, DBGetUserInfo, DBFollowUser, DBRemoveFollower, DBSearchAccounts, DBGetProfile, DBGetProfileFollowers, DBGetProfileFollowing, DBEditProfile, DBEditAccount } = require('./accounts.js');
const { DBAddPost, DBGetPost, DBAddPostComment, DBGetPostComments, DBGetAllPosts, DBLikePost, DBLikeComment, DBGetHomePosts, DBEditPost, DBDeletePost } = require('./posts.js');
const { DBAddReport } = require('./reports.js');


const AuthLog = new Map();

const URLs = {
    add_post: "/api/addpost", // auth
    edit_post: "/api/editpost", // auth
    delete_post: "/api/deletepost", // auth
    get_post: "/api/getpost", // optional auth
    get_all_posts: "/api/getallposts", // optional auth
    get_home_posts: "/api/gethomeposts", // auth

    add_post_comment: "/api/addpostcomment", // auth
    get_post_comments: "/api/getpostcomments", // optional auth

    register: "/api/register", // no auth
    login: "/api/login", // no auth
    auth: "/api/auth", // auth
    edit_profile: "/api/editprofile", // auth
    edit_username: "/api/editusername", // auth
    edit_email: "/api/editemail", // auth
    edit_password: "/api/editpassword", // auth

    get_profile: "/api/getprofile", // optional auth
    get_profile_followers: "/api/getprofilefollowers", // no auth
    get_profile_following: "/api/getprofilefollowing", // no auth

    like_post: "/api/likepost", // auth
    like_comment: "/api/likecomment", // auth

    follow_user: "/api/followuser", // auth
    remove_follower: "/api/removefollower", // auth

    search_accounts: "/api/searchaccounts", // no auth

    account_report: "/api/accountreport", // auth
    post_report: "/api/postreport", // auth
    comment_report: "/api/commentreport", // auth
    bug_report: "/api/bugreport" // auth
};

exports.ResObj = (url, doc) => {
    if (url === URLs.add_post) return { postid: doc };
    else if (url === URLs.get_post) return { post: doc };
    else if (url === URLs.get_all_posts) return { posts: doc };
    else if (url === URLs.get_home_posts) return { posts: doc };
    else if (url === URLs.get_post_comments) return { comments: doc };
    else if (url === URLs.register) return { token: doc };
    else if (url === URLs.login) return { token: doc };
    else if (url === URLs.auth) return { userinfo: doc };
    else if (url === URLs.edit_username) return { token: doc };
    else if (url === URLs.edit_email) return { token: doc };
    else if (url === URLs.edit_password) return { token: doc };
    else if (url === URLs.get_profile) return { profile: doc };
    else if (url === URLs.get_profile_followers) return { followers: doc };
    else if (url === URLs.get_profile_following) return { following: doc };
    else if (url === URLs.search_accounts) return { results: doc };
    else return {};
}

exports.DB = (action, username, token, data, ip) => {
    return new Promise((resolve, reject) => {

        // API calls

        if (action === URLs.add_post) {
            if (checkArgs([
                { data: data.message, name: "message", type: 'string', strict: true, max: 600, optional: true },
                { data: data.attach, name: "attach", type: 'array', strict: true, max: 3, optional: true }
            ], reject, true) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {

                DBAddPost(username, data).then((id) => resolve(id), (err) => reject(err));

            }, (err) => reject(err));
        }
        else if (action === URLs.edit_post) {
            if (checkArgs([
                { data: data.postid, name: "postid", type: 'string', strict: true },
                { data: data.message, name: "message", type: 'string', strict: true, max: 600 }
            ], reject) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {

                DBEditPost(username, data).then(() => resolve(1), (err) => reject(err));

            }, (err) => reject(err));
        }
        else if (action === URLs.delete_post) {
            if (checkArgs([
                { data: data.postid, name: "postid", type: 'string', strict: true }
            ], reject) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {

                DBDeletePost(username, data.postid).then(() => resolve(1), (err) => reject(err));

            }, (err) => reject(err));
        }
        else if (action === URLs.add_post_comment) {
            if (checkArgs([
                { data: data.postid, name: "postid", type: 'string', strict: true },
                { data: data.comment, name: "comment", type: 'string', strict: true, max: 400 }
            ], reject) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {

                DBAddPostComment(username, data).then(() => resolve(1), (err) => reject(err));

            }, (err) => reject(err));
        }
        else if (action === URLs.get_post_comments) {
            if (checkArgs([
                { data: data.postid, name: "postid", type: 'string', strict: true }
            ], reject) !== 1) return reject();
            
            if (!empty(username, token)) { // while logged in
                DBValidate(username, token, ip).then(() => {

                    DBGetPostComments(data.postid, username).then((doc) => resolve(doc), (err) => reject(err));

                }, (err) => reject(err));
            }
            else { // without logging in
                DBGetPostComments(data.postid).then((doc) => resolve(doc), (err) => reject(err));
            }

        }
        else if (action === URLs.register) {
            if (checkArgs([
                { data: data.username, name: "username", type: 'string', strict: true },
                { data: data.password, name: "password", type: 'string', strict: true },
                { data: data.email, name: "email", type: 'string', strict: true },
                { data: data.fullname, name: "fullname", type: 'string', strict: true, optional: true },
                { data: data.birthdate, name: "birthdate", type: 'string', strict: true },
                { data: data.avatar, name: "avatar", type: 'string', strict: true, optional: true }
            ], reject) !== 1) return reject();

            if (!/^[a-z0-9_-]{3,16}$/.test(data.username)) {
                return reject(new Error("the username can't be shorter than 3 or longer than 16 characters, can't contain capital letters, whitespaces or special characters (except '-' and '_')"));
            }
            else if (!/^(?=.*[0-9])[a-zA-Z0-9_ !@#$%^&*]{8,16}$/.test(data.password)) {
                return reject(new Error("the password can't be shorter than 8 or longer than 16 characters, and must contain at least one number"));
            }
            else if (!/^(?!.*[0-9]).{0,32}$/.test(data.fullname)) {
                return reject(new Error("the full name can't be longer than 32 characters or contain numbers"));
            }
            else if (!/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(data.email) || data.email.length < 5 || data.email.length > 320) {
                return reject(new Error("the E-mail is invalid"));
            }
            else if (dateCheck(data.birthdate, reject) !== 1) return reject();

            DBRegister(data).then((token) => resolve(token), (err) => reject(err));

        }
        else if (action === URLs.login) {
            if (checkArgs([
                { data: data.username, name: "username", type: 'string', strict: true },
                { data: data.password, name: "password", type: 'string', strict: true }
            ], reject) !== 1) return reject();

            DBValidate(data.username, data.password, ip, true).then((token) => resolve(token), (err) => reject(err));

        }
        else if (action === URLs.auth) {
            DBValidate(username, token, ip).then(() => {
                DBGetUserInfo(username, 1).then((userinfo) => {
                    return resolve({
                        username: userinfo.username,
                        fullname: userinfo.fullname,
                        checkmark: userinfo.checkmark,
                        avatar: userinfo.avatar
                    });
                }, (err) => reject(err));
            }, (err) => reject(err));

        }
        else if (action === URLs.edit_username) {
            if (checkArgs([
                { data: data.newusername, name: "newusername", type: 'string', strict: true },
                { data: data.password, name: "password", type: 'string', strict: true }
            ], reject) !== 1) return reject();

            if (!/^[a-z0-9_-]{3,16}$/.test(data.newusername)) {
                return reject(new Error("the username can't be shorter than 3 or longer than 16 characters, can't contain capital letters, whitespaces or special characters (except '-' and '_')"));
            }

            DBValidate(username, token, ip).then(() => {

                DBValidate(username, data.password, ip, true).then(() => {
                    DBEditAccount(username, 0, data.newusername).then((token) => resolve(token), (err) => reject(err));
                }, (err) => reject(err));

            }, (err) => reject(err));

        }
        else if (action === URLs.edit_email) {
            if (checkArgs([
                { data: data.newemail, name: "newemail", type: 'string', strict: true },
                { data: data.password, name: "password", type: 'string', strict: true }
            ], reject) !== 1) return reject();

            if (!/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(data.newemail) || data.newemail.length < 5 || data.newemail.length > 320) {
                return reject(new Error("the E-mail is invalid"));
            }

            DBValidate(username, token, ip).then(() => {

                DBValidate(username, data.password, ip, true).then(() => {
                    DBEditAccount(username, 1, data.newemail).then((token) => resolve(token), (err) => reject(err));
                }, (err) => reject(err));

            }, (err) => reject(err));

        }
        else if (action === URLs.edit_password) {
            if (checkArgs([
                { data: data.newpassword, name: "newpassword", type: 'string', strict: true },
                { data: data.password, name: "password", type: 'string', strict: true }
            ], reject) !== 1) return reject();

            if (!/^(?=.*[0-9])[a-zA-Z0-9_ !@#$%^&*]{8,16}$/.test(data.newpassword)) {
                return reject(new Error("the password can't be shorter than 8 or longer than 16 characters, and must contain at least one number"));
            }
            else if (data.password === data.newpassword) return reject(new Error("new password can't be the same as the old password"));

            DBValidate(username, token, ip).then(() => {

                DBValidate(username, data.password, ip, true).then(() => {
                    DBEditAccount(username, 2, data.newpassword).then((token) => resolve(token), (err) => reject(err));
                }, (err) => reject(err));

            }, (err) => reject(err));

        }
        else if (action === URLs.edit_profile) {
            if (checkArgs([
                { data: data.fullname, name: "fullname", type: 'string', strict: true, optional: true },
                { data: data.avatar, name: "avatar", type: 'string', strict: true, optional: true }
            ], reject, true) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {

                DBEditProfile(username, data).then(() => resolve(1), (err) => reject(err));

            }, (err) => reject(err));

        }
        else if (action === URLs.get_post) {
            if (checkArgs([
                { data: data.postid, name: "postid", type: 'string', strict: true }
            ], reject) !== 1) return reject();

            if (!empty(username, token)) { // while logged in
                DBValidate(username, token, ip).then(() => {

                    DBGetPost(data.postid, username).then((doc) => resolve(doc), (err) => reject(err));

                }, (err) => reject(err));
            }
            else { // without logging in
                DBGetPost(data.postid).then((doc) => resolve(doc), (err) => reject(err));
            }

        }
        else if (action === URLs.get_all_posts) {
            if (checkArgs([
                { data: data.targetuser, name: "targetuser", type: 'string', strict: true }
            ], reject) !== 1) return reject();
            
            if (!empty(username, token)) { // while logged in
                DBValidate(username, token, ip).then(() => {

                    DBGetAllPosts(data.targetuser, username).then((doc) => resolve(doc), (err) => reject(err));

                }, (err) => reject(err));
            }
            else { // without logging in
                DBGetAllPosts(data.targetuser).then((doc) => resolve(doc), (err) => reject(err));
            }

        }
        else if (action === URLs.get_home_posts) {
            DBValidate(username, token, ip).then(() => {

                DBGetHomePosts(username).then((doc) => resolve(doc), (err) => reject(err));

            }, (err) => reject(err));

        }
        else if (action === URLs.like_post) {
            if (checkArgs([
                { data: data.postid, name: "postid", type: 'string', strict: true },
                { data: data.like, name: "like", type: 'boolean' }
            ], reject) !== 1) return reject();
            
            DBValidate(username, token, ip).then(() => {
                DBLikePost(username, data).then(() => resolve(1), (err) => reject(err));
            }, (err) => reject(err));

        }
        else if (action === URLs.like_comment) {
            if (checkArgs([
                { data: data.postid, name: "postid", type: 'string', strict: true },
                { data: data.commentid, name: "commentid", type: 'string', strict: true },
                { data: data.like, name: "like", type: 'boolean' }
            ], reject) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {
                DBLikeComment(username, data).then(() => resolve(1), (err) => reject(err));
            }, (err) => reject(err));

        }
        else if (action === URLs.follow_user) {
            if (checkArgs([
                { data: data.targetuser, name: "targetuser", type: 'string', strict: true },
                { data: data.follow, name: "follow", type: 'boolean' }
            ], reject) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {
                DBFollowUser(username, data).then(() => resolve(1), (err) => reject(err));
            }, (err) => reject(err));

        }
        else if (action === URLs.remove_follower) {
            if (checkArgs([
                { data: data.targetuser, name: "targetuser", type: 'string', strict: true }
            ], reject) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {
                DBRemoveFollower(username, data.targetuser).then(() => resolve(1), (err) => reject(err));
            }, (err) => reject(err));

        }
        else if (action === URLs.search_accounts) {
            if (checkArgs([
                { data: data.query, name: "query", type: 'string', strict: true, min: 3, max: 32 }
            ], reject) !== 1) return reject();

            DBSearchAccounts(data.query).then((doc) => resolve(doc), (err) => reject(err));

        }
        else if (action === URLs.account_report) {
            if (checkArgs([
                { data: data.username, name: "username", type: 'string', strict: true },
                { data: data.message, name: "message", type: 'string', strict: true, min: 3, max: 600 }
            ], reject) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {
                DBAddReport(username, 0, data).then(() => resolve(1), (err) => reject(err));
            }, (err) => reject(err));

        }
        else if (action === URLs.post_report) {
            if (checkArgs([
                { data: data.postid, name: "postid", type: 'string', strict: true },
                { data: data.message, name: "message", type: 'string', strict: true, min: 3, max: 600 }
            ], reject) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {
                DBAddReport(username, 1, data).then(() => resolve(1), (err) => reject(err));
            }, (err) => reject(err));
        }
        else if (action === URLs.comment_report) {
            if (checkArgs([
                { data: data.postid, name: "postid", type: 'string', strict: true },
                { data: data.message, name: "message", type: 'string', strict: true, min: 3, max: 600 },
                { data: data.commentid, name: "commentid", type: 'string', strict: true }
            ], reject) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {
                DBAddReport(username, 2, data).then(() => resolve(1), (err) => reject(err));
            }, (err) => reject(err));
        }
        else if (action === URLs.bug_report) {
            if (checkArgs([
                { data: data.category, name: "category", type: 'string', strict: true },
                { data: data.message, name: "message", type: 'string', strict: true, min: 3, max: 1000 }
            ], reject) !== 1) return reject();

            DBValidate(username, token, ip).then(() => {
                DBAddReport(username, 3, data).then(() => resolve(1), (err) => reject(err));
            }, (err) => reject(err));
        }
        else if (action === URLs.get_profile) {
            if (checkArgs([
                { data: data.targetuser, name: "targetuser", type: 'string', strict: true }
            ], reject) !== 1) return reject();

            if (!empty(username, token)) { // while logged in
                DBValidate(username, token, ip).then(() => {

                    DBGetProfile(data.targetuser, username).then((doc) => resolve(doc), (err) => reject(err));

                }, (err) => reject(err));
            }
            else { // without logging in
                DBGetProfile(data.targetuser).then((doc) => resolve(doc), (err) => reject(err));
            }

        }
        else if (action === URLs.get_profile_followers) {
            if (checkArgs([
                { data: data.targetuser, name: "targetuser", type: 'string', strict: true }
            ], reject) !== 1) return reject();

            DBGetProfileFollowers(data.targetuser).then((doc) => resolve(doc), (err) => reject(err));

        }
        else if (action === URLs.get_profile_following) {
            if (checkArgs([
                { data: data.targetuser, name: "targetuser", type: 'string', strict: true }
            ], reject) !== 1) return reject();

            DBGetProfileFollowing(data.targetuser).then((doc) => resolve(doc), (err) => reject(err));

        }
        else return reject(new Error("invalid fetch URL (at API fetch)"));

    });
}

const DBValidate = (username, tokenorpw, ip, mode = undefined) => {
    return new Promise((resolve, reject) => {
        if (empty(username, tokenorpw)) return reject(new Error("you are not authorized!"));
        if (empty(ip)) return reject(new Error("an error occured on the server (at API fetch)"));

        if (AuthLog.has(ip)) {
            if ((AuthLog.get(ip).lasttime + 600000) > new Date().getTime()) { // 10 minutes
                if (AuthLog.get(ip).attempts >= 3) {
                    if (mode) return reject(new Error("incorrect username or password, try again in a bit..."));
                    else return reject(new Error("you are not authorized, try again in a bit..."));
                }
            }
            else AuthLog.delete(ip);
        }

        if (mode) { // password mode
            
            DBLogin(username, tokenorpw).then((token) => {
                if (AuthLog.has(ip)) AuthLog.delete(ip);
                return resolve(token);
            }, 
            (err) => {
                if (AuthLog.has(ip)) {
                    const att = AuthLog.get(ip).attempts + 1;
                    AuthLog.set(ip, { lasttime: new Date().getTime(), attempts: att });
                }
                else {
                    AuthLog.set(ip, { lasttime: new Date().getTime(), attempts: 1 });
                }
                return reject(err);
            });
        }
        else { // token mode

            DBCheckToken(username, tokenorpw).then(() => {
                if (AuthLog.has(ip)) AuthLog.delete(ip);
                return resolve(1);
            },
            (err) => {
                if (AuthLog.has(ip)) {
                    const att = AuthLog.get(ip).attempts + 1;
                    AuthLog.set(ip, { lasttime: new Date().getTime(), attempts: att });
                }
                else {
                    AuthLog.set(ip, { lasttime: new Date().getTime(), attempts: 1 });
                }
                return reject(err);
            });
        }
    });
}

function empty() {
    const len = arguments.length;

    if (len === 0) return 1;
    else {
        for(let i = 0; i < len; i++) {
            if (arguments[i] === undefined || arguments[i] === null || arguments[i] === "" || /^\s*$/.test(arguments[i])) {
                return 1;
            }
        }
        return 0;
    }
}

function checkArgs(args, reject, atleastone = undefined) {
    if (!Array.isArray(args)) return reject(new Error("an error occured on the server"));
    if (args.length === 0) return reject(new Error("an error occured on the server"));

    let valid = false;

    for (let i = 0; i < args.length; i++) {
        if (typeof args[i] === "object") {
            if (args[i].optional == true) {
                if (args[i].strict == true) {
                    if (args[i].data === undefined) {
                        continue;
                    }
                    else if (args[i].data === null || args[i].data === "" || /^\s*$/.test(args[i].data)) {
                        return reject(new Error("the optional argument '" + args[i].name + "' doesn't contain valid data, you can instead leave it 'undefined'"));
                    }
                    else if ((args[i].type === "string" && typeof args[i].data === "string") || (args[i].type === "number" && typeof args[i].data === "number") || (args[i].type === "boolean" && (typeof args[i].data === "boolean" || typeof args[i].data === "number")) || (args[i].type === "array" && Array.isArray(args[i].data))) {
                        minMaxCheck(args[i].data, args[i].name, args[i].type, args[i].min, args[i].max, reject);
                        if (atleastone) valid = true;
                        continue;
                    }
                    else return reject(new Error("the optional argument '" + args[i].name + "' has the wrong data type!"));
                }
                else {
                    if (args[i].data === undefined) {
                        continue;
                    }
                    else if (args[i].data === null || args[i].data === "") {
                        return reject(new Error("the optional argument '" + args[i].name + "' doesn't contain valid data, you can instead leave it 'undefined'"));
                    }
                    else if ((args[i].type === "string" && typeof args[i].data === "string") || (args[i].type === "number" && typeof args[i].data === "number") || (args[i].type === "boolean" && (typeof args[i].data === "boolean" || typeof args[i].data === "number")) || (args[i].type === "array" && Array.isArray(args[i].data))) {
                        minMaxCheck(args[i].data, args[i].name, args[i].type, args[i].min, args[i].max, reject);
                        if (atleastone) valid = true;
                        continue;
                    }
                    else return reject(new Error("the argument '" + args[i].name + "' has the wrong data type!"));
                }
            }
            else {
                if (args[i].strict == true) {
                    if (args[i].data === undefined || args[i].data === null || args[i].data === "" || /^\s*$/.test(args[i].data)) {
                        return reject(new Error("the argument '" + args[i].name + "' is empty!"));
                    }
                    else if ((args[i].type === "string" && typeof args[i].data === "string") || (args[i].type === "number" && typeof args[i].data === "number") || (args[i].type === "boolean" && (typeof args[i].data === "boolean" || typeof args[i].data === "number")) || (args[i].type === "array" && Array.isArray(args[i].data))) {
                        minMaxCheck(args[i].data, args[i].name, args[i].type, args[i].min, args[i].max, reject);
                        if (atleastone) valid = true;
                        continue;
                    }
                    else return reject(new Error("the argument '" + args[i].name + "' has the wrong data type!"));
                }
                else {
                    if (args[i].data === undefined || args[i].data === null || args[i].data === "") {
                        return reject(new Error("the argument '" + args[i].name + "' is empty!"));
                    }
                    else if ((args[i].type === "string" && typeof args[i].data === "string") || (args[i].type === "number" && typeof args[i].data === "number") || (args[i].type === "boolean" && (typeof args[i].data === "boolean" || typeof args[i].data === "number")) || (args[i].type === "array" && Array.isArray(args[i].data))) {
                        minMaxCheck(args[i].data, args[i].name, args[i].type, args[i].min, args[i].max, reject);
                        if (atleastone) valid = true;
                        continue;
                    }
                    else return reject(new Error("the argument '" + args[i].name + "' has the wrong data type!"));
                }
            }
        }
        else return reject(new Error("an error occured on the server"));
    }

    if (atleastone && !valid) reject(new Error("you need to pass at least one argument in the request body!"));

    return 1;

    function minMaxCheck(data, name, type, min, max, reject) {
        if (data === undefined || type === undefined || reject === undefined) return 0;
        if (min !== undefined) {
            if (type === "string" && data.length < min) return reject(new Error("the argument '" + name + "' can't be less then " + min + " characters long!"));
            else if (type === "number" && data < min) return reject(new Error("the value of the argument '" + name + "' can't be smaller then " + min + "!"));
            else if (type === "array" && data.length < min) return reject(new Error("the argument (array) '" + name + "' can't have less then " + min + " items!"));
        }
        if (max !== undefined) {
            if (type === "string" && data.length > max) return reject(new Error("the argument '" + name + "' can't be more then " + max + " characters long!"));
            else if (type === "number" && data > max) return reject(new Error("the value of the argument '" + name + "' can't be bigger then " + max + "!"));
            else if (type === "array" && data.length > max) return reject(new Error("the argument (array) '" + name + "' can't have more then " + max + " items!"));
        }

        return 1;
    }
}

function dateCheck(str, reject) {
    const bdate = str.split("-");
    if (typeof bdate !== "object" || bdate.length !== 3 || empty(bdate[0], bdate[1], bdate[2])) return reject(new Error("you entered an invalid birth date!"));

    const yr = Number(bdate[0]), mon = Number(bdate[1]) - 1, day = Number(bdate[2]);

    if (yr < 1900) return reject(new Error("you entered an invalid birth date!"));
    else if (day < 1) return reject(new Error("you entered an invalid birth date!"));
    else if (empty(yr, mon, day)) return reject(new Error("you entered an invalid birth date!"));
    else if (isNaN(yr) || isNaN(mon) || isNaN(day)) return reject(new Error("you entered an invalid birth date!"));

    switch (mon) {
        case 0:
            if (day > 31) return reject(new Error("you entered an invalid birth date!"));
            break;
        case 1:
            if (day > 28) {
                if (yr % 4 === 0 && day > 29) return reject(new Error("you entered an invalid birth date!"));
                else if (yr % 4 !== 0) return reject(new Error("you entered an invalid birth date!"));
            }
            break;
        case 2:
            if (day > 31) return reject(new Error("you entered an invalid birth date!"));
            break;
        case 3:
            if (day > 30) return reject(new Error("you entered an invalid birth date!"));
            break;
        case 4:
            if (day > 31) return reject(new Error("you entered an invalid birth date!"));
            break;
        case 5:
            if (day > 30) return reject(new Error("you entered an invalid birth date!"));
            break;
        case 6:
            if (day > 31) return reject(new Error("you entered an invalid birth date!"));
            break;
        case 7:
            if (day > 31) return reject(new Error("you entered an invalid birth date!"));
            break;
        case 8:
            if (day > 30) return reject(new Error("you entered an invalid birth date!"));
            break;
        case 9:
            if (day > 31) return reject(new Error("you entered an invalid birth date!"));
            break;
        case 10:
            if (day > 30) return reject(new Error("you entered an invalid birth date!"));
            break;
        case 11:
            if (day > 31) return reject(new Error("you entered an invalid birth date!"));
            break;
        default:
            return reject(new Error("you entered an invalid birth date!"));
    }

    const birthDate = new Date(str);
    const now = new Date();
    if (birthDate > now) return reject(new Error("you entered an invalid birth date!"));
    
    let age = now.getFullYear() - birthDate.getFullYear();
    const m = now.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
        age--;
    }
    if (age < 13) return reject(new Error("you must be at least 13 years old to make an account!"));

    return 1;
}