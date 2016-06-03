var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
const bodyParser = require('body-parser')
var redis = require('redis');
var mongoose = require('mongoose');


// var client_id = process.env.SPOTIFY_CLIENT_ID
var keys = {
  client_id : '59cf69d14f744a93a0d83408c52bd6c6',
  client_secret : '8a991f3620254d36a1c6778edf3adff6'
}
// var client_secret = process.env.SPOTIFY_CLIENT_SECRET
var redirect_uri = 'http://localhost:8888/callback';


//controllers
var apiController = require('./controllers/api.js');
//connect to redis
if (process.env.REDISGREEN_URL != null) {
  redisgreen = require("url").parse(process.env.REDISGREEN_URL);
  redisClient = redis.createClient(redisgreen.port, redisgreen.hostname);
  redisClient.auth(redisgreen.auth.split(":")[1]);
} else {
  redisClient = redis.createClient();
}
//connect to Mongo
mongoose.connect(process.env.MONGOLAB_URI || 'mongodb://localhost/spotifydb');


var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();
app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.use(express.static(__dirname + '/public'))
   .use(cookieParser())
   .use(bodyParser.json())
   .use(bodyParser.urlencoded({extended: false}))

app.get('/', (req, res) =>{
	res.render('index')
})

app.get('/myInfo', (req, res) =>{
	return redisClient.get('personInfo', function(err, data){
		if((data != null) && !err){
			var parsedInfo = JSON.parse(data)
			console.log('parsedInfo ', parsedInfo);
			res.render('myinfo', {data: parsedInfo})
		} else{
			console.log('error from myinfo ', err)
		}

	})
})

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email playlist-read-private user-library-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: keys.client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state,
      show_dialog: true
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(keys.client_id + ':' + keys.client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {

    	var myInfoArr = [];
    	var authInfoObj = {};

      if (!error && response.statusCode === 200) {

        var access_token = body.access_token;
        var refresh_token = body.refresh_token;

        var meOptions = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(meOptions, function(error, response, body) {
          // console.log('me ', body);
          myInfoArr.push(body);
          //SAVE USERNAME WITH ACCESS TOKEN AND REFRESH TO REDIS
          authInfoObj.user = body.id;
          authInfoObj.access_token = access_token;
          authInfoObj.refresh_token = refresh_token;
          redisClient.set(authInfoObj.user, JSON.stringify(authInfoObj))
          console.log('stringifyed authInfoObj', JSON.stringify(authInfoObj))

          redisClient.set('usernames', body.id)
          // res.render('myinfo', {data : body});
          request.post({
          	url: 'http://localhost:8888/api/addUser',
          	form:{
          		username : authInfoObj.user,
              access_token : authInfoObj.access_token,
              refresh_token : authInfoObj.refresh_token
          	} },
          	function(error, response, body){
	          	if(error){
	          		console.log(error)
	          	}else{
                console.log('THIS IS THE OBJ.id', authInfoObj.user)
          			console.log('this is the body of Username ', body)
          		}
          	})
        });

        var playlistOptions = {
        	url: 'https://api.spotify.com/v1/me/tracks',
        	headers: { 'Authorization': 'Bearer ' + access_token },
        	json: true
        };

        request.get(playlistOptions, function(error, response, body) {
        	// console.log('playlist ', body);
        	myInfoArr.push(body);
        	res.render('myinfo', {data : myInfoArr});
        	redisClient.set('personInfo', JSON.stringify(myInfoArr), function(err, res) {
        		if(err){
        			console.log('Redis Error : ', err);
        		}
        		console.log('Redis Set : personInfo - ', res);
        	})
        });

        // we can also pass the token to the browser to make requests from there
        // res.redirect('/#' +
        //   querystring.stringify({
        //     access_token: access_token,
        //     refresh_token: refresh_token
        //   }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });

  }
});

app.get('/refresh_token', function(req, res) {
	console.log('REFRESHING TOKEN');
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(keys.client_id + ':' + keys.client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

//API routes
app.post('/api/addUser', apiController.addUser);


console.log(new Date(), 'Listening on 8888');
app.listen(8888);