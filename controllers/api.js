const User = require('../models/users.js');

var api = {
	addUser: (req, res) =>{
		var userData = req.body;

		// var newUser = new User(userData);
		// newUser.save(function(err, result){
		// 	console.log('this is the save to db err: ', err)
		// 	res.send(result);
		// })
		console.log('adding User', userData)
		User.findOneAndUpdate(
			{username: req.body.username},
			{username: userData.username, auth:{access_token: userData.access_token, refresh_token: userData.refresh_token}},
			{upsert: true, new: true}
		).exec()
	},

	getUsers: (req, res)=>{
		User.find({}, 
			function(err, result){
				console.log('this is the get from db err: ', err);
				res.send(result);
			}
		)
	}

}

module.exports = api;