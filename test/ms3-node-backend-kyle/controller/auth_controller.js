var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var secret = require('../secret/secret.json')
var jwt = require('jsonwebtoken');
var crypto = require('crypto');

const Datastore = require('@google-cloud/datastore');
const datastore = Datastore();

router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

router.use(function timeLog (req, res, next) {
  console.log('In Auth Controller @ Time: ', Date.now());
  next();
});

router.route('/')

	.post(function(req, res, next){ // verify request body
		if (req.body.email === undefined || req.body.password === undefined) {
			res.status(400);
			res.json({ message: "Malformed Request" });
		} else {
			next();
		}
	}, function(req, res, next) { // verify user entity exists and active
		try {
			const query = datastore.createQuery('User_V1').filter('email', '=', req.body.email);
			datastore.runQuery(query, function(err, entities) {
				if (err) {
					console.error(err);
					res.status(500);
					res.json({ message: "Internal Server Error" });
				} else {
					if (entities.length == 0) {
			            res.status(401);
			            res.json({ message: "Invalid Email/Password Combo" });
			        } else {
						try {
	                    	var password_hash = crypto.createHmac('sha256', secret.password_secret)
								.update(req.body.password)
								.digest('hex');
			                var user_data = entities[0];
			                var user_key = entities[0][datastore.KEY];
			                if (user_data.active === false){
			                    res.status(403);
			                    res.json({ message: "Inactive account" });
			                } else if (user_data.password_hash !== password_hash){
			                    res.status(401);
			                    res.json({ message: "Invalid Email/Password Combo" });
			                } else {
			                	res.locals.user_key = user_key;
								res.locals.user_data = user_data;
			                    next();	
			                }
						} catch (err) {
							console.error(err);
							res.status(500);
							res.json({ message: "Internal Server Error" });
						}
					}
				}
			});
		} catch (err) {
			console.error(err);
			res.status(500);
			res.json({ message: "Internal Server Error" });
		}
	}, function(req, res){ // generate user auth token and return summarized user info
		try {
			var auth_token = jwt.sign({
				data: {
					id : res.locals.user_key.id,
					email : res.locals.user_data.email,
					type : 'user'
				}
			}, secret.token_secret, { expiresIn: '14d' });

			res.status(200);
			res.json({
				token: auth_token,
		    	user: {
					email: res.locals.user_data.email,
					id: res.locals.user_key.id,
					wishlist: res.locals.user_data.wishlist
				}
			});
		} catch (err) {
			console.error(err);
			res.status(500);
			res.json({ message: "Internal Server Error" });
		}
	})

	.delete(function(req, res, next){ // verify JWT auth token, verify token payload
		try {
			var token = req.get('token')
			var decoded = jwt.verify(token, secret.token_secret);
			if (decoded.data.id === undefined || decoded.data.email === undefined || decoded.data.type === undefined) {
				throw new Error('Missing JWT Payload Property');
			}
			res.locals.token = token;
			res.locals.decoded = decoded;
			next();
		} catch (err) {
			console.error(err);
			res.status(204).send();
		}
	}, function(req, res, next){ // verify JWT auth token is not already blacklisted
		try {
			const query = datastore.createQuery('Token_Blacklist_V1').filter('token', '=', res.locals.token);
			datastore.runQuery(query, function(err, entities) {
				if (err) {
					console.error(err);
					res.status(204).send();
				} else {
					if (entities.length == 0) {
		                res.locals.token_key = datastore.key(['Token_Blacklist_V1']);
						res.locals.token_data = {
							token : res.locals.token,
							exp : res.locals.decoded.exp
						};
						next();
	                } else {
	                	console.error("Token already blacklisted");
	                	res.status(204).send();
                    }
				}
			});
		} catch (err) {
			console.error(err);
			res.status(204).send();
		}
	}, function(req, res){ // add token to token blacklist
		datastore.save({
			key: res.locals.token_key,
			data: res.locals.token_data
		}, function(err) {
			if (err) {
				console.error(err);
			}
		});
		res.status(204).send();
	});


module.exports = router;
