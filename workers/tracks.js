var redis = require('redis');
var request = require('request');
var keys = require('../.env');
var mongoose = require('mongoose');
const User = require('../models/users.js');

//controllers
var apiController = require('../controllers/api.js');

if (process.env.REDISGREEN_URL != null) {
  redisgreen = require("url").parse(process.env.REDISGREEN_URL);
  redisClient = redis.createClient(redisgreen.port, redisgreen.hostname);
  redisClient.auth(redisgreen.auth.split(":")[1]);
} else {
  redisClient = redis.createClient();
}

//connect to Mongo
mongoose.connect(process.env.MONGOLAB_URI || 'mongodb://localhost/spotifydb');

var userArray = [];

getUsers = () => {
	//send request to MONGO and return
	User.find({},
		function(err, result){
			console.log('this is the get from db err: ', err);
			// console.log('this is the get from db result: ', result);
			userArray = result;
		}
	)

}

getInfo = (cb, access_token, refresh_token, user, isNewToken) => {
	var client_id = keys.client_id;
	var client_secret = keys.client_secret;
	var user = user ? user : userArray[0].username;

	cb = cb != null ? cb : function() {};
  	var access_token = access_token != null ? access_token : '';
  	console.log('this is userArray coming from the getinfo()', access_token, refresh_token, user, isNewToken)
  	//get object from getUsers()

	// redisClient.get('authInfo', function(err, res){
	// var parsedAuth = JSON.parse(res);

	console.log('NEW TOKEN  -- ', isNewToken)
	access_token = isNewToken == true ? access_token : access_token;
	refresh_token = refresh_token;
	// access_token = newToken == true ? access_token : parsedAuth.access_token;
	// refresh_token = parsedAuth.refresh_token;
		// console.log('access token tracks ', access_token);

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
			    console.log('NEW ACCES TOKEN for', user, refreshedAccessToken);
			    //save new credentials to MONGO
			    User.findOneAndUpdate(
					{username: user},
					{username: user, auth:{access_token: refreshedAccessToken, refresh_token: refresh_token}},
					{upsert: true, new: true}
				).exec()
				//RECURSIVE FUNKYTION!!!!!!!
			    getInfo(cb, refreshedAccessToken, refresh_token, user, true)
			  }
			});
		}else{
	    	redisClient.set(user+'personInfo', JSON.stringify(body.total), function(err, res) {
	    		if(err){
	    			console.log('Redis Error : ', err);
	    		}
	    		console.log('Redis Set : personInfo - ', res);
	    		return cb();
	    	})
	    }
	    return cb();
    });//end request

  	//INSTEAD OF USING EXPRESS FOR THE REQ AND RES, SEND USING REQUEST
}

setInterval(function() {
  	//loop getInfo for the number of Users
  	for(var i = 0; i<userArray.length; i++){
		console.log('getting info for ', userArray[i].username, i);
		console.log('this is userArray coming from the getinfo()', userArray)
  		getInfo(null, userArray[i].auth.access_token, userArray[i].auth.refresh_token, userArray[i].username, false);
  	}
}, 10000);

setInterval(function() {
	getUsers();
}, 30000);

getUsers();
console.log('USER ARRAY: ', userArray)
// getInfo();