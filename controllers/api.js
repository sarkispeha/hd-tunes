const User = require('../models/users.js');

var api = {
	addUser: (req, res) =>{
		var userData = req.body;

		var newUser = new User(userData);
		newUser.save(function(err, result){
			console.log('this is the save to db err: ', err)
			res.send(result);
		})
	}

}

module.exports = api;