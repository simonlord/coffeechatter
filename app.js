var fs = require('fs');
var gravatar = require('gravatar');
var _ = require('underscore');

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var pubsub = require('pubsub');
var request = require('request');
var cheerio = require('cheerio');
var async = require('async');

var app = express();

app.use(favicon(__dirname + '/public/img/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/html'))); // for index.html

var linkRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

var msgFilters = [];
msgFilters.push(function(msgType, item, cb){
    if(item.msg){
        var msg = replaceUrlWithHtmlLinks(item.msg);
        item.msg = msg;
    }
    cb(null, msgType, item);
});

msgFilters.push(function(msgType, item, cb){
    if(item.msg && hasLink(item.msg)){    
	var rawLink = extractRawLink(item.msg);
	if(rawLink.match(/\.(gif|jpg|jpeg|tiff|png)$/i)){
	  item.imageURL = rawLink;
	  console.log("Got image link: " + item.imageURL);
	}
    }
    cb(null, msgType, item);
});

msgFilters.push(function(msgType, item, cb){
    var msg = item.msg;
    if (msg && msg.substring(0, 1) == '/') {
	    var bits = msg.split(" ");
	    var cmd = bits[0].substring(1, bits[0].length);
	    switch (cmd) {
		case "me":
		    console.log("/me command received from " + item.user.nick + ": " + cmd);
		    var ann = msg.substring(msg.indexOf(' '), msg.length);
		    var annItem = {announce: ann, user: item.user, when: item.when};
		    cb(null, msgType, annItem);
		    break;
		case "coffee":
		case "foos":
	    }
    } else {
        cb(null, msgType, item);
    } 
});

function addMsg(msg, user){
        var item = {msg: msg, user: user, when: currentTime()};
	var initialCB = function(cb){cb(null,'msg',item);};
        async.waterfall(_.flatten([initialCB,msgFilters]), function(err, msgType, item){
                mq.publish(msgType, item);
        });    
}

var mq = pubsub();
mq.subscribe(function (msgType, item) {
    io.sockets.emit(msgType, item);
});

mq.subscribe(function (msgType, item) {
    var historyItem = {type: msgType, payload: item};
    historyItem.payload.history = true;
    history.push(historyItem);
    if (history.length > 50) {
        history = history.slice(history.length - 50, history.length);
    }
    fs.writeFile('.history', JSON.stringify(history), function (err) {
        if (err)throw err;
    });
});

mq.subscribe(function (msgType, item) {
    if (msgType !== 'msg') {
        return;
    }
    if (hasLink(item.msg) === false) {
        return;
    }
    var rawLink = extractRawLink(item.msg);
    request({proxy: 'http://www-proxy.us.oracle.com:80', uri: rawLink}, function (err, rsp, body) {
        var pageTitle = rawLink;
        var favIcon = null;
        if (!err && rsp.statusCode == 200) {
            if(rsp.headers['content-type'].match(/text\/html/) === null){
                return;
	    }
            var $ = cheerio.load(body);
            pageTitle = $('head title').text();
            $('head link').each(function (i, elem) {
                var rel = $(this).attr('rel');
                if (rel.match(/icon/i) !== null) {
                    favIcon = $(this).attr('href');
                    if(rel === 'icon'){
                        // if we get an exact match break free
                        return false;
                    }
		    if(rel === 'shortcut icon'){
		        return false;
		    }
                }
            });
        } else {
            console.log("Failed to retrieve title and favicon for " + rawLink + " - " + err + " - " + rsp.statusCode);
	    return;
        }
        var newlink = {link: rawLink, title: pageTitle, favicon: favIcon, user: item.user, when: currentTime()};
        links.unshift(newlink);
        io.sockets.emit("updatelinks", links);
        fs.writeFile('.linklist', JSON.stringify(links), function (err) {
            if (err)throw err;
        });
    });
});

app.get('/msg/:msg', function (rq, rs) {
    console.log('Incoming msg from REST endpoint: ' + rq.params.msg);
    addMsg(rq.params.msg, 'system');
    rs.send('Thanks');
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.send(err.message);
});


var server = http.Server(app);
var io = require('socket.io').listen(server);
var users = [];
var history = [];
var links = [];

fs.readFile('.linklist',
  function (err, data) {
      if (err) {
          console.log("Failed to load .history file:" + err);
      } else {
          links = JSON.parse(data);
          console.log("Loaded link list, size: " + links.length);
      }
  }
);
fs.readFile('.history',
  function (err, data) {
      if (err) {
          console.log("Failed to load .history file:" + err);
      } else {
          history = JSON.parse(data);
          console.log("Loaded history, size: " + history.length);
      }
  }
);

function currentTime() {
    var d = new Date();
    var hours = d.getHours() < 10 ? "0" + d.getHours() : d.getHours();
    var minutes = d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes();
    var time = hours + ":" + minutes;
    return time;
}

function replaceUrlWithHtmlLinks(text) {
    return text.replace(linkRegex, "<a href='$1' target='_blank'>$1</a>");
}

function hasLink(text) {
    if(text){
        return text.match(linkRegex) !== null;
    }
    return false;
}

function extractRawLink(text) {
    return text.match(linkRegex)[0];
}

function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
}

function guid() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
      s4() + '-' + s4() + s4() + s4();
}

function retrieveGravatar(email) {
    return gravatar.url("" + email, {s: '50', r: 'pg', d: 'retro'});
}


io.sockets.on('connection', function (socket) {
    // first send history
    for (i = 0; i < history.length; i++) {
        var item = history[i];
        socket.emit(item.type, item.payload);
    }

    socket.emit("updatelinks", links.slice(0,10));

    socket.on('adduser', function (username, email) {
        if (username === undefined || username === "") {
            username = "lazyuser-" + s4();
        }
        if (email === null) {
            email = username; // just to make different default icons get produced
        }
        var user = {nick: username, gravatar: retrieveGravatar(email)};
        socket.user = user;
        users.push(user);
        io.sockets.emit('updateusers', users);
    });

    socket.on('disconnect', function () {
        nickToRemove = typeof socket.user !== 'undefined' ? socket.user.nick : "";
        users = _.reject(users, function (user) {
            return user.nick == nickToRemove;
        });
        io.sockets.emit('updateusers', users);
    });

    socket.on('coffeecommand', function (data) {
        data.user = socket.user;
        data.when = currentTime();
        if (data.type == 'vote') {
            data.voteid = guid();
        }
        mq.publish('coffeecommand', data);
    });

    socket.on('msg', function (data) {
	addMsg(data.msg,socket.user);
    });

    socket.on('vote', function (data) {
        var item = {
            votename: data.votename,
            voteid: data.voteid,
            vote: data.vote,
            user: socket.user,
            when: currentTime()
        };
        mq.publish('voted', item);
    });
});

var port = process.env.PORT || 7777;
server.listen(port);
console.log("Server started on port " + port);


module.exports = app;
