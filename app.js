var http = require('http');
var fs = require('fs');
var url = require('url');

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
    history.push(item);
    if(history.length > 20){
        history = history.slice(history.length-20,history.length);
    }
}
function currentTime(){
    var d = new Date();
    var time = d.getHours() + ":" + d.getMinutes();
    return time;
}
function replaceUrlWithHtmlLinks(text) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp,"<a href='$1' target='_blank'>$1</a>"); 
}
io.sockets.on('connection', function (socket) {
  // first send history
  for(i=0;i<history.length;i++){
    var item = history[i];
    console.log("History: "+item);
    socket.emit(item.type, item.payload);
  }
  socket.on('adduser', function(username){
    socket.username=username;
    users.push(username);
    var item = {msg: username + ' is now online', nick:'Server', when:currentTime()};
    io.sockets.emit('msg', item);
    addHistoryItem({type:'msg', payload: item});
    io.sockets.emit('updateusers', users);
  });
  socket.on('disconnect', function(){
    users.splice(users.indexOf(socket.username), 1);
    var item = {msg: socket.username + ' has gone awol', nick:'Server', when:currentTime()};
    io.sockets.emit('msg', item);
    addHistoryItem({type:'msg',payload:item});
    io.sockets.emit('updateusers', users);
  });
  socket.on('coffeecommand', function (data) {
    console.log(data);
    data.nick = socket.username;
    data.when = currentTime();
    io.sockets.emit('coffeecommand', data);
    addHistoryItem({type:'coffeecommand',payload:data});
  });
  socket.on('msg', function (data) {
    console.log(data);
    var msg = replaceUrlWithHtmlLinks(data.msg);
    var item = {msg:msg, nick:socket.username, when:currentTime()};
    io.sockets.emit('msg', item);
    addHistoryItem({type:'msg',payload:item});
  });
});

app.listen(7777);
console.log("Server started");

