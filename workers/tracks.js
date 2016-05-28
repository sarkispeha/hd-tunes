var redis = require('redis');
var request = require('request');

if (process.env.REDISGREEN_URL != null) {
  redisgreen = require("url").parse(process.env.REDISGREEN_URL);
  redisClient = redis.createClient(redisgreen.port, redisgreen.hostname);
  redisClient.auth(redisgreen.auth.split(":")[1]);
} else {
  redisClient = redis.createClient();
}

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

getUsers = () => {
	redisClient.get('usernames', function(err, res){
		var users = [];
		users.push(res)
		console.log(users);
	})
}

getInfo = (cb, access_token, refresh_token, user, newToken) => {
	var client_id = '';
	var client_secret = '';

	cb = cb != null ? cb : function() {};
  var access_token = access_token != null ? access_token : '';

	redisClient.get('authInfo', function(err, res){
		var parsedAuth = JSON.parse(res);

		console.log('NEW TOKEN  -- ', newToken)
		access_token = newToken == true ? access_token : parsedAuth.access_token;
		refresh_token = parsedAuth.refresh_token;
  	console.log('access token tracks ', access_token);
    var playlistOptions = {
    	url: 'https://api.spotify.com/v1/me/tracks',
    	headers: { 'Authorization': 'Bearer ' + access_token },
    	json: true
        };

	request.get(playlistOptions, function(error, response, body) {
		console.log('this is the body from first request', body)
		// console.log('this is error ', error)
		var errorStatus = body.error ? body.error.status : false;
		if (errorStatus){
			console.log(body.error)
			console.log('WE NEED A NEW ACCESS_TOKEN')
			//refresh access_token with refresh_token
			var authOptions = {
			    url: 'https://accounts.spotify.com/api/token',
			    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
			    form: {
			      grant_type: 'refresh_token',
			      refresh_token: refresh_token
			    },
			    json: true
			};
			request.post(authOptions, function(error, response, body) {
			  if (!error && response.statusCode === 200) {
			    var refreshedAccessToken = body.access_token;
			    console.log('NEW ACCES TOKEN ', refreshedAccessToken);
			    // redisClient.set('authInfo')
			    getInfo(cb, refreshedAccessToken, refresh_token, user, true)//RECURSIVE FUNKYTION!!!!!!!
			  }
			});
		}else{
	    	redisClient.set('personInfo', JSON.stringify(body), function(err, res) {
	    		if(err){
	    			console.log('Redis Error : ', err);
	    		}
	    		console.log('Redis Set : personInfo - ', res);
	    		return cb();
	    	})
	    }
    });
		
	})
  	// var state = generateRandomString(16);
  	// res.cookie(stateKey, state);

  	// app.get('/login', function(req, res) {

  	// var scope = 'user-read-private user-read-email playlist-read-private user-library-read';
  	// res.redirect('https://accounts.spotify.com/authorize?' +
	  //   querystring.stringify({
	  //     response_type: 'code',
	  //     client_id: client_id,
	  //     scope: scope,
	  //     redirect_uri: redirect_uri,
	  //     state: state
	  //   }));
  	// });

  	//INSTEAD OF USING EXPRESS FOR THE REQ AND RES, SEND USING REQUEST
}

setInterval(function() {
	console.log('getting info');
  	getInfo();
  	getUsers();
}, 20000);

getUsers();
getInfo();