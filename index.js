const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors'); // Import the 'cors' middleware
const bodyParser = require('body-parser');

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
app.use(bodyParser.json());


app.get('/getEvents', async (req, res) => {
	await client.connect();
	const db = client.db('thinkpink');
	const collection = db.collection('events');

	//const objectId = new ObjectId("65395ca09544dacb9c7372ab");
	var result = await collection.find({}).toArray();

    res.json(result);
});

app.post('/createEvent', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('events');

    // Assuming you have a request body containing the event data
    const eventData = req.body;

    console.log("Inserted event: "+JSON.stringify(eventData)) 
    // Insert the eventData into the 'events' collection
    const result = await collection.insertOne(eventData);

    // Check if the insertion was successful
    if (result.insertedCount == 1) {
      res.status(201).json({ message: 'Event created successfully' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});

app.patch('/editEvent/:event_id', async (req, res) => {
  try {
    const event_id = req.params.event_id;

    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('events');

    console.log(`Updating event ${event_id} with done=true`);
    const result = await collection.updateOne(
    { _id: new ObjectId(event_id) },  
   // { $set: { done: true } } // add the new object

  )} catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});

app.put('/doneEvent/:event_id', async (req, res) => {
  try {
    const event_id = req.params.event_id;

    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('events');

    console.log(`Updating event ${event_id} with done=true`);
    const result = await collection.updateOne(
    { _id: new ObjectId(event_id) },  
    { $set: { done: true } }            

); 
    res.status(200).send('OK');
   // console.log(req.body);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await client.close();
  }
});

app.delete('/deleteEvent/:event_id', async (req, res) => {
  try {
    const event_id = req.params.event_id;
    await client.connect();
    const db = client.db('thinkpink');
    const collection = db.collection('events');

    const result = await collection.deleteOne({ _id: new ObjectId(event_id) });
    res.status(200).send('OK');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal server error');
  } finally {
    await client.close();
  }
});




const API_PORT = process.env.API_PORT || 3000;
app.listen(API_PORT, () => console.log(`Express API listening on port ${API_PORT}`));

