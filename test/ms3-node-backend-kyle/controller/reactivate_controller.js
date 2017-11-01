var express = require('express');
var router = express.Router();
var bodyParser = require('body-parser');
var secret = require('../secret/secret.json')
var jwt = require('jsonwebtoken');
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
  console.log('In Reactivate Controller @ Time: ', Date.now());
  next();
});

router.route('/')
	
	.post(function(req, res, next){ // verify request body
		if (req.body.email === undefined) {
			res.status(400);
			res.json({ message: 'Malformed Request' });
		} else {
			next();
		}
	}, function(req, res, next){ // verify user entity exists and inactive
		try {
			const query = datastore.createQuery('User_V1').filter('email', '=', req.body.email);
			datastore.runQuery(query, function(err, entities) {
				if (err) {
					console.error(err);
					res.status(500);
					res.json({ message: 'Internal Server Error' });
				} else {
					if (entities.length == 0) {
					  	res.status(404);
					  	res.json({ message: 'User Resource Does Not Exist' });
			        } else {
			        	var user_data = entities[0];
			            var user_key = entities[0][datastore.KEY];
		            	if (user_data.active === true) {
							res.status(409);
							res.json({ message: 'Account Already Active' });
		            	} else {
		            		res.locals.id = user_key.id;
		            		res.locals.email = user_data.email;
			                next();	
		            	}
		        	}
	        	}
			});
		} catch (err) {
			console.error(err);
			res.status(500);
			res.json({ message: 'Internal Server Error' });
		}
	}, function(req, res, next) { // TODO verify user entity not in user blacklist - Iteration 2
		next();
	}, function(req, res) { // activate user entity
		try {
    		var token = jwt.sign({
				data: {
					id : res.locals.id,
					email : res.locals.email,
					type : 'activation'
				}
			}, secret.token_secret, { expiresIn: '1h' });

    		var activation_link = 'https://ms3-web.firebaseapp.com/account/activate?token=' + token;
    		var mailOptions = {
			  from: 'ms3.cs506@gmail.com',
			  to: res.locals.email,
			  subject: 'MS3 Activation Link',
			  text: activation_link
			};

			transporter.sendMail(mailOptions, function(err, info){
			  	if (err) {
			    	console.error(err);
			    	res.status(500);
					res.json({ message: 'Internal Server Error' });
			  	} else {
			  		console.log(info);
			    	res.status(200);
    				res.json({ message: "Activation Email Sent" });
			  	}
			});

		} catch(err){
			console.error(err);
			res.status(500);
			res.json({ message: 'Internal Server Error' });
		}
	});

module.exports = router;
