/**
 * Module dependencies.
 */

var app = require('../app');
var	assert = require('assert');

module.exports = {

    'TEST GET /': function() {
        assert.response(app,
	        { url: '/' },
	        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }},
	        function(res) {
	            assert.includes(res.body, '<title>Home</title>');
	        }
		);
	}

	// This test is not running
	// 'POST /documents.json': function(assert) {
	//     assert.response(app,
	// 	{
	//         url: '/documents.json',
	//         method: 'POST',
	//         data: JSON.stringify({ document: { title: 'Test' } }),
	//         headers: { 'Content-Type': 'application/json' }
	//     },
	// 	{ status: 200, headers: { 'Content-Type': 'application/json' }},
	// 
	//     function(res) {
	//         var document = JSON.parse(res.body);
	//         assert.equal('Test', document.title);
	//     });
	// }
	
}