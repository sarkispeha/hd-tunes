var redis = require('redis');

if (process.env.REDISGREEN_URL != null) {
  redisgreen = require("url").parse(process.env.REDISGREEN_URL);
  redisClient = redis.createClient(redisgreen.port, redisgreen.hostname);
  redisClient.auth(redisgreen.auth.split(":")[1]);
} else {
  redisClient = redis.createClient();
}

getUsers = () => {
	redisClient.get('usernames')
}

setInterval(function() {
	console.log('getting info');
  	getUsers();
}, 20000);

getUsers();