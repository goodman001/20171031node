var supertest = require('supertest');
var should = require('should');
var server  = supertest.agent('http://127.0.0.1:3000');


describe('/', function() {
    it('GET Test Example', function(done) {
    	server
    		.get('/')
			.expect(200) // Change 200 to 400 to see fail example
			.expect("Hello",done) // Change '/json/' to '/text/' to see fail example
        ;
    });

})

describe('/api/users Test', function() {
    it('GET Test Example', function(done) {
    	server
    		.get('/api/users')
			.expect(200) // Change 200 to 400 to see fail example
			.expect("Content-Type",/json/) // Change '/json/' to '/text/' to see fail example
			.end(function(err, res){
				if (err)
					done(err);
				console.log(res.body);
			});
    });
    var user = {email:"test@gmail.com",password:"12345",notification:"test norification"}
    it('POST Test Example', function(done) {
    	server
    		.post('/api/users')
            .send(user)
			.expect(201)
			.expect("Content-Type",/json/)
			.end(function(err, res){
				if (err)
					done(err);
				res.body.should.have.property('message');
				res.body.message.should.equal('Created');
				done();
			});
    });
    it('Get Test /:id/activate', function(done) {
    	server
    		.post('/api/users/1/activate')
            .send(user)
			.expect(201)
			.expect("Content-Type",/json/)
			.end(function(err, res){
				if (err)
					done(err);
				res.body.should.have.property('message');
				res.body.message.should.equal('Created');
				done();
			});
    });
})
