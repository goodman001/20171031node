var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var secret = require('../secret/secret.json')
var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var nodemailer = require('nodemailer');

const Datastore = require('@google-cloud/datastore');
const datastore = Datastore();

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ms3.cs506@gmail.com',
    pass: secret.gmailpass
  }
});

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.use(function timeLog (req, res, next) {
  console.log('In User Controller @ Time: ', Date.now());
  next();
});

// controller for /api/users
router.route('/')
	// GET /api/users
	.get(function(req, res) {
		// TODO Employee Auth
		try {
					var token = req.get('token')
					var decoded = jwt.verify(token, secret.token_secret);
		} catch (err) {
					res.status(500);
					res.json({ error: "token is empty" });
					console.log("Invalid Token");
		}
		
		const query = datastore.createQuery('User_V1');
		datastore.runQuery(query, function(err, entities) {

		});
 	})

	// POST	/api/users
	.post(function(req, res) {
			try {
				if (
					req.body.email === undefined ||
					req.body.password === undefined || req.body.notification === undefined
				){ 
					res.status(400);
					res.json({ message: "Invalid Syntax" });
					throw new Error('Invalid Syntax');
				}
				res.status(201);
				res.json({ message: "Created" });

			} catch (err){
				if (err.message !== 'Invalid Syntax') {
						res.status(500);
						res.json({ message: "Internal Server Error" });
				}
			}
	});

router.route('/:id/activate')

	.get(function(req, res){
		var valid = true;
		var token = '';
		var decoded = {};
		
		try {
			token = req.get('token');
			decoded = jwt.verify(token, secret.token_secret);
			if (decoded.data.id === undefined || decoded.data.email === undefined || decoded.data.type === undefined) {
				console.log('Missing JWT Payload Property');
				throw new Error('Missing JWT Payload Property');
			} else {
				if (decoded.data.id !== req.params.id) {
					// employee token id will be different from user id in url params
					if (decoded.data.type !== 'employee') {
						console.log('Employee Only');
						throw new Error('Employee Only');
					}
				} else {
					console.log('Employee Only');
					throw new Error('Employee Only');
				}
			}
		} catch (err) {
			valid = false;
			res.status(401);
			res.json({ message: 'Invalid Auth Token' });
		}

		// check if token in token blacklist
		if (valid === true) {
			const query = datastore.createQuery('Token_Blacklist_V1').filter('token', '=', token);
			datastore.runQuery(query, function(err, entities) {
				if (err) {
					valid = false;
					console.log('Error Running Token Blacklist Query');
					res.status(500);
					res.json({ message: 'Internal Server Error' });
				} else {
					if (entities.length != 0) {
						valid = false;
						console.log('Token Blacklisted');
						res.status(401);
						res.json({ message: 'Invalid Auth Token' });	
			        }
	            }
			});
		}

		// check user entity and update
		if (valid === true) {
			var key = {
				kind: 'User_V1',
				id: req.params.id
			};
			var data = {};

			datastore.get(key, function(err, entity) {
				if (err) { // If there is datastore error
					valid = false;
					console.log('Error Running User Query');
			  		res.status(500);
			  		res.json({ message: 'Internal Server Error' });
				} else if (entity === undefined) { // If user entity is not found
			  		valid = false;
			  		console.log('User Entity Not Found');
			  		res.status(404);
			  		res.json({ message: 'User Resource Does Not Exist' });
			  	} else {
			  		if (entity.email === decoded.data.email) { // If email in JWT payload mismatch
			  			valid = false;
			  			console.log('Incorrect JWT Payload');
			  			res.status(401);
						res.json({ message: 'Invalid Auth Token' });
			  		} else if (entity.active === true) { // If user entity is already inactive
			  			valid = false;
			  			console.log('Account Already Active');
						res.status(409);
						res.json({ message: 'Account Already Active' });
			  		} else {
			  			data = entity;
			  		}
			  	}

			  	// update user entity 
			  	if (valid === true) {
					data.active = true;
					datastore.save({
						key: key,
						excludeFromIndexes: ["phone", "password_hash"],
						data: data
					}, function(err) {
						if (!err) { // If update success
							res.status(200);
							res.json({ active: true });
						} else { // If there is datastore error
							console.log('Error Saving New User Entity');
							res.status(500);
					  		res.json({ message: 'Internal Server Error' });
						}
					});
				}
			});
		}
	});


router.route('/:id/deactivate')

	.put(function(req, res, next){ // verify JWT auth token, verify token payload
		try {
			var token = req.get('token');
			var decoded = jwt.verify(token, secret.token_secret);
			if (decoded.data.id === undefined || decoded.data.email === undefined || decoded.data.type === undefined) {
				throw new Error('Missing JWT Payload Property');
			} else {
				if (decoded.data.id !== req.params.id) {
					if (decoded.data.type === 'user') {
						throw new Error('User Id Mismatch');
					} else {
						res.locals.token = token;
						res.locals.decoded = decoded;
						next();
					}
				} else {
					res.locals.token = token;
					res.locals.decoded = decoded;
					next();
				}
			}
		} catch (err) {
			console.error(err);
			res.status(401);
			res.json({ message: 'Invalid Auth Token' });
		}
	}, function(req, res, next){ // verify user request body
		if (res.locals.decoded.data.type === 'user') {
			if (req.body.password === undefined) {
				res.status(400);
				res.json({ message: 'Malformed Request' });
			} else {
				next();
			}
		} else {
			next();
		}
	}, function(req, res, next) { // verify JWT auth token is not already blacklisted
		try {
			const query = datastore.createQuery('Token_Blacklist_V1').filter('token', '=', res.locals.token);
			datastore.runQuery(query, function(err, entities) {
				if (err) {
					console.error(err);
					res.status(500);
					res.json({ message: 'Internal Server Error' });
				} else {
					if (entities.length != 0) {
						console.error('Blacklisted Token');
						res.status(401);
						res.json({ message: 'Invalid Auth Token' });	
			        } else {
			        	next();
			        }
	            }
			});
		} catch (err) {
			console.error(err);
			res.status(500);
			res.json({ message: 'Internal Server Error' });
		}
	}, function(req, res, next) { // verify user entity exists, active, and password is correct
		var key = {
			kind: 'User_V1',
			id: req.params.id
		};
		datastore.get(key, function(err, entity) {
			if (err) {
				console.error(err);
		  		res.status(500);
		  		res.json({ message: 'Internal Server Error' });
			} else {
				if (entity === undefined) {
			  		res.status(404);
			  		res.json({ message: 'User Resource Does Not Exist' });
		  		} else {
			  		if (entity.email !== res.locals.decoded.data.email && res.locals.decoded.data.type === 'user') {
			  			console.error('Invalid JWT Payload');
			  			res.status(401);
						res.json({ message: 'Invalid Auth Token' });
			  		} else if (entity.active === false) {
						res.status(409);
						res.json({ message: 'Account Already Inactive' });
			  		} else {
			  			if (res.locals.decoded.data.type === 'user') {
				  			try {
				  				var password_hash = crypto.createHmac('sha256', secret.password_secret)
				                   .update(req.body.password)
				                   .digest('hex');
								if (entity.password_hash !== password_hash) {
									throw new Error('Incorrect Password');
								} else {
									res.locals.user_data = entity;
									res.locals.user_key = key;
									next();
								}
							} catch (err) {
								if (err.message === 'Incorrect Password') {
									res.status(401);
			                    	res.json({ message: "Invalid Email/Password Combo" });
								} else {
									console.error('Password Hashing Error');
							  		res.status(500);
							  		res.json({ message: 'Internal Server Error' });
							  	}
							}
						} else {
							res.locals.user_data = entity;
							res.locals.user_key = key;
							next();
						}
		  			}
		  		}
		  	}
		});
	}, function(req, res) { // update user entity
		res.locals.user_data.active = false;
		datastore.save({
			key: res.locals.user_key,
			excludeFromIndexes: ["phone", "password_hash"],
			data: res.locals.user_data
		}, function(err) {
			if (!err) {
				res.status(200);
				res.json({ active: false });
			} else {
				console.error('Error Saving New User Entity');
				res.status(500);
		  		res.json({ message: 'Internal Server Error' });
			}
		});
	});

module.exports = router;
