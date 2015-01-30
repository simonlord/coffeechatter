

var commands = {
commands:[
         { id: 0, name: "I could really go a coffee", type: "stmt", class:"label-info"},
         { id: 1, name: "Who wants coffee?", type: "vote", class:"label-success", choices:['Yes','No']},
         { id: 2, name: "Coffee Brewing", type: "stmt", class:"label-warning"},
         { id: 3, name: "Coffee Ready", type: "stmt", class:"label-danger"},
         { id: 4, name: "We are out of coffee", type: "stmt", class:"label-danger"},
         { id: 5, name: "Lunch?", type: "vote", class:"label-success", choices:['Yes','No']},
         { id: 6, name: "Foos?", type: "vote", class:"label-success", choices:['Yes','No']},
         { id: 7, name: "Baristas?", type: "vote", class:"label-success", choices:['Yes','No']},
         { id: 8, name: "We are running out of coffee!", type: "stmt", class:"label-info"},
         { id: 9, name: "Bacon?", type: "vote", class:"label-success", choices:['Yes','No']}
         ]
};

setTimeout(function() {
    dust.render("commands", commands, function(err,out) {
        $('#commands').append(out);
    });
}, 10);

var socket = null;
function connect(nick,email){
    console.log("connecting");
    var server = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ":"+window.location.port : "");
    socket = io.connect(server);
    socket.on('connect', function () {
            socket.emit('adduser', nick, email);
            $('#loginRow').hide();
            $('#postLoginContent').fadeIn();
	    console.log("connected");
            });
    socket.on('disconnect', function() {
            $('#disconnectedContent').fadeIn();
            $('#postLoginContent').fadeTo(5,0.25);
    	    notify('CoffeeChatter','Disconnected','WebSocket disconnected from server - please login again', false);
	    });
    socket.on('coffeecommand', function (data) {
            console.log(data);
            dust.render("coffeecommand",data,function(err,out){$('#messages').prepend(out);});
            if(nick != data.user.nick){
            //$.titleAlert('New Coffee Command');
            notify(data.user, data.user.nick,data.name, data.history);
            }
            });
    socket.on('msg', function (data) {
            console.log(data);
            dust.render("msg",data,function(err,out){$('#messages').prepend($.emoticons.replace(out));});
            var msg = data.msg;
            if(data.announce){
            msg = data.announce;
            }
            if(nick != data.user.nick){
            notify(data.user, data.user.nick, msg, data.history);
            }
            });
    socket.on('updateusers', function (data) {
            console.log(data);
            var users = {users:data};
            $('#users').empty();
            dust.render("userlist",users,function(err,out){$('#users').append(out);});
            });
    socket.on('voted',function(data){
            console.log(data);
            dust.render("voted",data,function(err,out){$('#vote-responses-for-vote-'+data.voteid+'-'+data.vote).append(out);});
            notify(data.user, data.user.nick,data.vote + " for " + data.votename, data.history);
            });
    socket.on('updatelinks', function (data) {
            console.log(data);
            var links = {links:data};
            $('#links').empty();
            dust.render("linklist",links,function(err,out){$('#links').append(out);});
            });
}

var focused = true;

window.onfocus = function() {
    focused = true;
};
window.onblur = function() {
    focused = false;
};

function notify(user, title, message, historical){
    historical = (typeof historical !== 'undefined') ? historical : false;
    if(focused === false && historical === false){
        if (window.Notification.permission === 'granted') { 
            var notification = new Notification(title,{icon:user.gravatar,body:message});
            notification.onshow = function(){
                setTimeout(function(){
                        notification.close();
                        }, 1000*30);
            };

            notification.show();
        }
    }
}

$(function(){
        $('#login').click(function(){
            var nick = $('#nick').val();
            var email = $('#email').val();

            connect(nick,email);

            if (window.Notification) {
            console.log("Notifications are supported!");
            if (Notification.permission !== "denied") {
            Notification.requestPermission(function (permission) {
                // Whatever the user answers, we make sure we store the information
                if(!('permission' in Notification)) {
                Notification.permission = permission;
                }
                });
            }
            } else {
            console.log("Notifications are not supported for this Browser/OS version yet.");
            }
            return false;
        });
        // when the client clicks SEND
        $('#send').click( function() {
            var message = $('#msgInput').val();
            $('#msgInput').val('');
            $('#msgInput').focus();
            // tell server to execute 'sendchat' and send along one parameter
            socket.emit('msg', {msg:message});
            return false;
        });

        // when the client hits ENTER on their keyboard
        $('#msgInput').keypress(function(e) {
            if(e.which == 13) {
                $(this).blur();
                $('#send').focus().click();
                return false;
            }
        });
});
var coffeecommand = function(command){
    socket.emit('coffeecommand',command);
};
var vote = function(voteid, vote, votename){
    console.log("voting for "+vote+ " on voteid "+voteid+", "+votename);
    socket.emit('vote',{voteid:voteid, vote:vote, votename:votename});
};
