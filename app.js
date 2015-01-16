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

//var routes = require('./routes/index');

var app = express();
var server = http.Server(app);

app.use(favicon(__dirname + '/public/img/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/html'))); // for index.html

//app.use('/', routes);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});




var io = require('socket.io').listen(server);
var users = [];
var history = [];

fs.readFile('.history',
    function(err,data){
        if(err){
            console.log("Failed to load .history file:" + err);
        } else {
            history = JSON.parse(data);
            console.log("Loaded history, size: " + history.length);
        }
    }
);

setInterval(function(){
    fs.writeFile('.history',JSON.stringify(history),
        function(err){
            if(err)throw err;
            console.log("Saved history");
        });
    }, 20000
);

function addHistoryItem(item){
    item.payload.history=true;
    history.push(item);
    if(history.length > 20){
        history = history.slice(history.length-20,history.length);
    }
}

function currentTime(){
    var d = new Date();
    var hours = d.getHours() < 10 ? "0"+d.getHours() : d.getHours();
    var minutes = d.getMinutes() < 10 ? "0"+d.getMinutes() : d.getMinutes();
    var time = hours + ":" + minutes;
    return time;
}

function replaceUrlWithHtmlLinks(text) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp,"<a href='$1' target='_blank'>$1</a>"); 
}

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1);
}

// deal with irc like commands beginning with a /
function handleIrcCommand(socket,data){
    var msg = data.msg;
    if(msg.substring(0,1) != '/'){
	//no op
	return;
    }
    
    var bits = msg.split(" ");
    var cmd = bits[0].substring(1,bits[0].length);
    switch(cmd){
       case "me":
	   console.log("/me command received from " + socket.user.nick + ": " + cmd);
           var ann = msg.substring(msg.indexOf(' '),msg.length);
           var item = {announce:ann, user:socket.user, when:currentTime()};
           io.sockets.emit('msg', item);
           addHistoryItem({type:'msg',payload:item});    
           break;
      case "coffee":
      case "foos":
    } 
}

function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
}

function retrieveGravatar(email){
    return gravatar.url(""+email, {s: '50', r: 'pg', d: 'retro'});
}

io.sockets.on('connection', function (socket) {
  // first send history
  for(i=0;i<history.length;i++){
    var item = history[i];
    socket.emit(item.type, item.payload);
  }

  socket.on('adduser', function(username, email){
    if(username === null){
    	username = "lazyuser-" + s4();
    }
    if(email === null){
        email = username; // just to make different default icons get produced
    }
    var user = {nick:username, gravatar: retrieveGravatar(email)};
    socket.user=user;
    users.push(user);
    io.sockets.emit('updateusers', users);
  });

  socket.on('disconnect', function(){
    nickToRemove = typeof socket.user !== 'undefined' ? socket.user.nick : "";
    users = _.reject(users, function(user){return user.nick == nickToRemove;});
    io.sockets.emit('updateusers', users);
  });

  socket.on('coffeecommand', function (data) {
    data.user = socket.user;
    data.when = currentTime();
    if(data.type == 'vote'){
        data.voteid = guid();
    }
    io.sockets.emit('coffeecommand', data);
    addHistoryItem({type:'coffeecommand',payload:data});
  });

  socket.on('msg', function (data) {
    if(data && data.msg) {
        var msg = replaceUrlWithHtmlLinks(data.msg);
        if(msg.substring(0,1) == '/'){
             handleIrcCommand(socket,data);
        } else{
           var item = {msg:msg, user:socket.user, when:currentTime()};
           io.sockets.emit('msg', item);
           addHistoryItem({type:'msg',payload:item});
        }
    }
  });

  socket.on('vote', function (data) {
    var item = {votename:data.votename, voteid: data.voteid, vote:data.vote, user:socket.user, when:currentTime()};
    io.sockets.emit('voted', item);
    addHistoryItem({type:'voted',payload:item});
  });
});

var port = process.env.PORT || 7777;
server.listen(port);
console.log("Server started on port " + port);



module.exports = app;
