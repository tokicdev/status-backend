const express = require('express');
const path = require('path');
const { DB, ResObj } = require('./db/main.js');

const PORT = process.env.PORT || 3001;
const app = express();


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Username, Token");
    next();
});
app.set('trust proxy', true);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/static', express.static("public"));


app.post("*", (req, res) => {
    if (req.get('Content-Type').startsWith('text/plain')) res.json({ error: "The header 'Content-Type' cannot be empty or 'text/plain'!" });
    else {

        DB(req.url, req.get('username'), req.get('token'), req.body, req.ip)
        .then((doc) => {
            res.json(ResObj(req.url, doc));
        }, (err) => {
            res.json({ error: err.message });
            console.log(err);
        })
        .catch((err) => console.log(err));
    }
});


app.get("*", (req, res) => {
    if (req.url === "/") {
        res.sendFile(path.join(__dirname, "docs.html"));
    }
    else res.sendStatus(404);
});

app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
});