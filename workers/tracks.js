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

getInfo = (cb, access_token, refresh_token, user) => {
	cb = cb != null ? cb : function() {};
  	
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

    var playlistOptions = {
    	url: 'https://api.spotify.com/v1/me/tracks',
    	headers: { 'Authorization': 'Bearer ' + access_token },
    	json: true
        };
	request.get(playlistOptions, function(error, response, body) {
		console.log(body)
		console.log('this is error ', error)
    	redisClient.set('personInfo', JSON.stringify(body), function(err, res) {
    		if(err){
    			console.log('Redis Error : ', err);
    		}
    		console.log('Redis Set : personInfo - ', res);
    		return cb();
    	})
    });
}

setInterval(function() {
	console.log('getting info');
  	getInfo();
}, 20000);

getInfo();