var http = require('http');
var fs = require('fs');
var url = require('url');
var gravatar = require('gravatar');
var _ = require('underscore');

var app = http.createServer(function(rq,rs){
    console.log("rq received for " + rq.url);
    var pathname = url.parse(rq.url).pathname;
    if(pathname == '/'){
        pathname = '/html/index.html';
    }
    fs.readFile(__dirname + '/public' + pathname,
        function (err, data) {
            if (err) {
                rs.writeHead(500);
                return rs.end('Error loading ' + pathname);
            }

            rs.writeHead(200);
            rs.end(data);
        });
});

var io = require('socket.io').listen(app);
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
    }, 20000);
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
    console.log("History: "+item);
    socket.emit(item.type, item.payload);
  }
  socket.on('adduser', function(username, email){
    console.log(username + " " + email);
    if(email == null){
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
    console.log(data);
    data.user = socket.user;
    data.when = currentTime();
    if(data.type == 'vote'){
        data.voteid = guid();
    }
    io.sockets.emit('coffeecommand', data);
    addHistoryItem({type:'coffeecommand',payload:data});
  });
  socket.on('msg', function (data) {
    console.log(data);
    var msg = replaceUrlWithHtmlLinks(data.msg);
    if(msg.substring(0,1) == '/'){
	     handleIrcCommand(socket,data);
    }else{
       var item = {msg:msg, user:socket.user, when:currentTime()};
       io.sockets.emit('msg', item);
       addHistoryItem({type:'msg',payload:item});
    }
  });
  socket.on('vote', function (data) {
    console.log(data);
    var item = {votename:data.votename, voteid: data.voteid, vote:data.vote, user:socket.user, when:currentTime()};
    io.sockets.emit('voted', item);
    addHistoryItem({type:'voted',payload:item});
  });
});

app.listen(7777);
console.log("Server started");

