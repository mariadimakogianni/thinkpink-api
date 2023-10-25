const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors'); // Import the 'cors' middleware

const { ObjectId } = require('mongodb'); // Import the ObjectId constructor


//define url of mongo
const dbUrl = 'mongodb://localhost:27017/thinkpink';
//
//import mongo client
const { MongoClient } = require('mongodb');

//initialize the connection
const client = new MongoClient('mongodb://localhost:27017/thinkpink');
//

app.use(cors({ origin: 'http://localhost:8080' })); // Allow requests from this origin


app.get('/getEvents', async (req, res) => {
	await client.connect();
	const db = client.db('thinkpink');
	const collection = db.collection('events');

	//const objectId = new ObjectId("65395ca09544dacb9c7372ab");
	var result = await collection.find({}).toArray();

    res.json(result);
});

const API_PORT = process.env.API_PORT || 3000;
app.listen(API_PORT, () => console.log(`Express API listening on port ${API_PORT}`));

